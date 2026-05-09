/**
 * GET /api/agent/github/install — start the GitHub App install flow.
 *
 * The /dashboard/agent "Connect GitHub" button hits this route. We
 * resolve the calling team's scope, encode it as the GitHub App
 * `state` parameter, and 302 to the GitHub install URL. After the
 * customer installs the App, GitHub redirects back to our callback
 * route with the `installation_id` + the same `state`.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { buildInstallUrl, isGithubAppConfigured } from "@/lib/agent/github-app";
import { teamScope } from "@/lib/team-scope";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(
      new URL(
        "/sign-in?redirect_url=/dashboard/agent",
        process.env.NEXT_PUBLIC_APP_URL ?? "https://contentrx.io",
      ),
    );
  }
  if (!isGithubAppConfigured()) {
    // Surface a friendly redirect back to /dashboard/agent. The
    // page renders "registration in progress" copy for this state.
    return NextResponse.redirect(
      new URL(
        "/dashboard/agent?error=github_app_not_configured",
        process.env.NEXT_PUBLIC_APP_URL ?? "https://contentrx.io",
      ),
    );
  }

  const db = getDb();
  const [row] = (await db
    .select({
      id: schema.users.id,
      teamOwnerUserId: schema.users.teamOwnerUserId,
    })
    .from(schema.users)
    .where(eq(schema.users.clerkId, userId))
    .limit(1)) as Array<{ id: string; teamOwnerUserId: string | null }>;

  if (!row) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/agent?error=account_not_provisioned",
        process.env.NEXT_PUBLIC_APP_URL ?? "https://contentrx.io",
      ),
    );
  }

  // The state carries the team scope; the callback decodes it back
  // to know which ContentRX team owns the new installation.
  const state = teamScope({
    user: { id: row.id },
    teamOwnerUserId: row.teamOwnerUserId,
  });
  const url = buildInstallUrl(state);
  if (!url) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/agent?error=github_app_not_configured",
        process.env.NEXT_PUBLIC_APP_URL ?? "https://contentrx.io",
      ),
    );
  }
  return NextResponse.redirect(url);
}
