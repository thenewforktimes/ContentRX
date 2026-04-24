/**
 * Disk-backed cadence snapshot reader — human-eval build plan Session 33.
 *
 * Server-side only; uses `node:fs`. Each cadence derives its
 * `lastCompletedAt` from a different artifact:
 *
 *   weekly   — most recent row in `violation_overrides`. The weekly
 *              "review" is surface-level; completion is implicit when
 *              the team has at least glanced at the queue this week,
 *              so we can't observe it directly. We approximate it as
 *              "last override inspected" by reading the newest
 *              override timestamp. Good enough to show "there IS a
 *              queue" vs "empty". The DB-backed check lives in the
 *              page component; this helper returns null.
 *
 *   monthly  — latest file under `evals/drift/reports/`. Pre-Session
 *              7 we used the mtime; post-Session 7 the filename
 *              encodes the quarter (YYYY-Qn) — pick the max.
 *
 *   quarterly — same source as monthly. The distinction is the
 *              cycle's *purpose* (monthly = calibration summary read;
 *              quarterly = recalibration run). Both anchor on the
 *              drift report.
 *
 *   annual   — latest file under `evals/annual_audit/reports/`.
 *              Filenames are `<year>.json` or `<year>.md`; the json
 *              report is canonical.
 *
 * No DB access here — the weekly cadence's DB-based "last override"
 * timestamp is resolved in the server component that has a DB handle.
 * This module is filesystem-only so it stays cheap + mockable.
 */

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();

function safeStatMtime(filePath: string): Date | null {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return null;
  }
}

function latestFileIn(
  dir: string,
  predicate: (name: string) => boolean,
): string | null {
  try {
    if (!fs.existsSync(dir)) return null;
    const matches = fs
      .readdirSync(dir)
      .filter(predicate)
      .sort()
      .reverse();
    return matches[0] ? path.join(dir, matches[0]) : null;
  } catch {
    return null;
  }
}

/** Latest drift report timestamp — used for both monthly + quarterly. */
export function latestDriftReportCompletedAt(): Date | null {
  const dir = path.join(REPO_ROOT, "evals", "drift", "reports");
  const file = latestFileIn(dir, (n) => n.endsWith(".json"));
  if (!file) return null;
  return safeStatMtime(file);
}

/** Latest annual audit report timestamp. */
export function latestAnnualReportCompletedAt(): Date | null {
  const dir = path.join(REPO_ROOT, "evals", "annual_audit", "reports");
  const file = latestFileIn(dir, (n) => n.endsWith(".json"));
  if (!file) return null;
  return safeStatMtime(file);
}

/**
 * File paths + freshness info for a surface-level listing. Used by
 * the hub dashboard to show which artifacts exist on disk.
 */
export interface ArtifactRef {
  label: string;
  relativePath: string;
  lastCompletedAt: Date | null;
}

export function cadenceArtifactRefs(): ArtifactRef[] {
  return [
    {
      label: "Drift reports (quarterly + monthly)",
      relativePath: "evals/drift/reports/",
      lastCompletedAt: latestDriftReportCompletedAt(),
    },
    {
      label: "Annual audit reports",
      relativePath: "evals/annual_audit/reports/",
      lastCompletedAt: latestAnnualReportCompletedAt(),
    },
  ];
}
