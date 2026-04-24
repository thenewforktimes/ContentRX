/**
 * docs-site prebuild: copy canonical engine data into `docs-site/lib/`
 * so webpack can bundle it.
 *
 * The docs site deploys from its own root (docs-site/) and is Node-
 * only at build time — it cannot import Python or reach files outside
 * the project root at runtime. The prebuild step copies committed
 * JSON from the parent repo so the bundler can resolve them via
 * standard `import` statements.
 *
 * Human-eval build plan Session 20 added moments_taxonomy.json
 * (exported from moments.py by tools/export_moments.py) and the
 * examples corpus pairs.json to the set of files copied.
 */

import { execSync } from "node:child_process";
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const libDir = join(here, "..", "lib");

// Guard against Finder / iCloud space-suffixed duplicate files
// (shared with parent app's prebuild). See scripts/check_no_dup_files.sh.
// Runs before the copies so a dup under docs-site/lib/ doesn't get
// silently overwritten (or alongside), creating worse state.
try {
  execSync("bash scripts/check_no_dup_files.sh", {
    cwd: repoRoot,
    stdio: "inherit",
  });
} catch (err) {
  // The guard already printed its own error + fix. Re-exit with
  // its code so `next build` never runs.
  process.exit(err.status ?? 1);
}

const copies = [
  {
    from: join(repoRoot, "src", "content_checker", "standards", "standards_library.json"),
    to: join(libDir, "standards_library.json"),
  },
  {
    from: join(repoRoot, "src", "content_checker", "standards", "moments_taxonomy.json"),
    to: join(libDir, "moments_taxonomy.json"),
  },
  {
    from: join(repoRoot, "evals", "examples_corpus", "pairs.json"),
    to: join(libDir, "examples_pairs.json"),
  },
  // Human-eval build plan Session 23 — taxonomy changelog reads from
  // this markdown log's `## Approved refinements` section.
  {
    from: join(repoRoot, "taxonomy_refinement_log.md"),
    to: join(libDir, "taxonomy_refinement_log.md"),
  },
];

for (const { from, to } of copies) {
  cpSync(from, to);
  console.log(`copied ${from} → ${to}`);
}
