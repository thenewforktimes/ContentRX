/**
 * One-shot migration runner for the agent_github_installations table
 * (Phase G3 follow-up — GitHub App delivery path).
 *
 * Same shape as scripts/apply-agent-runs-migration.mjs: applies the
 * SQL drizzle-kit would generate from schema.ts directly via the
 * `postgres` library, sidestepping drizzle-kit's TTY confirmation
 * requirement. Idempotent: every statement is guarded so a re-run
 * is safe.
 *
 * Usage: `node scripts/apply-agent-github-installations-migration.mjs`
 * from a shell that has DATABASE_URL exported (or with .env.local
 * present).
 *
 * Delete this file after the change is rolled out and any subsequent
 * db:push has been run interactively.
 */

import "dotenv/config";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envLocalPath = resolve(process.cwd(), ".env.local");
try {
  const raw = readFileSync(envLocalPath, "utf-8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) {
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  }
} catch {
  // .env.local missing — fall back to whatever the shell exported.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "[apply-agent-github-installations] DATABASE_URL is not set.",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  console.log("[apply-agent-github-installations] Connecting...");
  await sql`SELECT 1`;
  console.log(
    "[apply-agent-github-installations] Connected. Applying migration...",
  );

  await sql`
    CREATE TABLE IF NOT EXISTS "agent_github_installations" (
      "id" text PRIMARY KEY NOT NULL,
      "team_id" text NOT NULL,
      "github_installation_id" integer NOT NULL,
      "github_account_login" text NOT NULL,
      "github_account_type" text NOT NULL,
      "target_repo_owner" text NOT NULL,
      "target_repo_name" text NOT NULL,
      "target_branch" text DEFAULT 'main' NOT NULL,
      "last_pr_number" integer,
      "last_pr_url" text,
      "last_pr_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `;
  console.log(
    "[apply-agent-github-installations]   ✓ CREATE TABLE agent_github_installations",
  );

  await sql`
    ALTER TABLE "agent_github_installations" ENABLE ROW LEVEL SECURITY
  `;
  console.log(
    "[apply-agent-github-installations]   ✓ ENABLE ROW LEVEL SECURITY",
  );

  await sql`
    DO $$
    BEGIN
      ALTER TABLE "agent_github_installations"
      ADD CONSTRAINT "agent_github_installations_team_id_users_id_fk"
      FOREIGN KEY ("team_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'agent_github_installations_team_id_users_id_fk already exists';
    END $$
  `;
  console.log(
    "[apply-agent-github-installations]   ✓ FOREIGN KEY agent_github_installations.team_id → users.id",
  );

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS
      "agent_github_installations_team_unique"
    ON "agent_github_installations" ("team_id")
  `;
  console.log(
    "[apply-agent-github-installations]   ✓ UNIQUE INDEX agent_github_installations_team_unique",
  );

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS
      "agent_github_installations_installation_id_unique"
    ON "agent_github_installations" ("github_installation_id")
  `;
  console.log(
    "[apply-agent-github-installations]   ✓ UNIQUE INDEX agent_github_installations_installation_id_unique",
  );

  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM "agent_github_installations"
  `;
  console.log(
    `[apply-agent-github-installations] Verified. agent_github_installations has ${count} rows.`,
  );
} catch (err) {
  console.error("[apply-agent-github-installations] FAILED:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
