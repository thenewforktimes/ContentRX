#!/usr/bin/env python3
"""Daily staleness watchdog over the report tree.

Phase C4 of the post-pivot rolling plan. Runs from
`.github/workflows/reports_staleness.yml`. Mirrors the staleness
logic in `src/lib/admin-reports.server.ts` so the founder-side
`/admin/reports` page and the cron-side watchdog flag the same
files.

Per-type thresholds (in days; anything older than the threshold is
stale):

    accuracy:    2    (nightly cadence + 1 day grace)
    calibration: 8    (Monday weekly cadence + 1 day grace)
    quarterly:   95   (first-Monday-of-quarter + slack)

Exits non-zero when at least one subdirectory contains no fresh
file. A non-zero exit fails the workflow, which routes a
notification to repo watchers via GitHub's standard email path.

How "modified" is determined: under `actions/checkout`, every
file's `st_mtime` is set to the checkout time, so a pure `os.stat`
read always reports the file as freshly modified — the watchdog
was therefore a no-op in CI. We now ask git for the last commit
timestamp of each file (`git log -1 --format=%ct -- <path>`),
which is the actual "last touched by a generator" time. If the
file isn't tracked in git (or git isn't on PATH), we fall back to
`st_mtime` with a loud warning rather than silently misreporting.

The architecture doc's reasoning: "stale reports are worse than no
reports for the named-expert moat — the moat depends on continuity
of evidence."
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

REPORTS_ROOT = Path("reports")

THRESHOLDS_DAYS: dict[str, int] = {
    "accuracy": 2,
    "calibration": 8,
    "quarterly": 95,
}

DAY_SECONDS = 86_400


def _git_committer_time(path: Path) -> float | None:
    """Return the unix timestamp of the file's last git commit, or None
    if git can't answer (file untracked, git not on PATH, etc.)."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%ct", "--", str(path)],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None
    stripped = out.stdout.strip()
    if not stripped:
        # File exists on disk but git has no commit record (untracked,
        # or just created and not yet staged).
        return None
    try:
        return float(stripped)
    except ValueError:
        return None


def _last_modified(path: Path) -> float:
    """Best-effort "last modified by a generator" timestamp.

    Prefers git committer time so the check works under
    `actions/checkout` (where every file's mtime is the checkout
    moment). Falls back to filesystem mtime — with a stderr warning
    — when git can't supply an answer, so a file that has never been
    committed still appears in the report.
    """
    ts = _git_committer_time(path)
    if ts is not None:
        return ts
    print(
        f"::warning ::{path}: no git commit history — falling back to "
        "filesystem mtime, which is unreliable in CI",
        file=sys.stderr,
    )
    return path.stat().st_mtime


def main() -> int:
    if not REPORTS_ROOT.is_dir():
        print(
            f"::error ::reports/ directory missing — generator scaffold not in place",
            file=sys.stderr,
        )
        return 2

    now = time.time()
    failures: list[str] = []

    for subdir, threshold_days in THRESHOLDS_DAYS.items():
        path = REPORTS_ROOT / subdir
        if not path.is_dir():
            failures.append(
                f"{path}: subdirectory missing"
            )
            continue
        files = [f for f in path.iterdir() if f.is_file() and not f.name.startswith(".")]
        if not files:
            failures.append(
                f"{path}: no generator output yet (Phase C generators "
                "haven't run, or the staleness monitor is configured "
                "before the first generation)"
            )
            continue
        newest = max(files, key=_last_modified)
        age_seconds = now - _last_modified(newest)
        age_days = age_seconds / DAY_SECONDS
        if age_days > threshold_days:
            failures.append(
                f"{path}: newest file {newest.name} is {age_days:.1f} days old "
                f"(threshold {threshold_days}d)"
            )
        else:
            print(
                f"::notice ::{path} fresh — {newest.name} is {age_days:.1f} days old"
            )

    if failures:
        for line in failures:
            print(f"::error ::{line}", file=sys.stderr)
        print(
            "::error ::Reports staleness check failed. "
            "Stale reports are worse than no reports for the "
            "named-expert moat — investigate before the next public "
            "deploy.",
            file=sys.stderr,
        )
        return 1
    print("::notice ::All report subdirectories are within their staleness thresholds.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
