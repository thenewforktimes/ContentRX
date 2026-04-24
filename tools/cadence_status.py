"""Print the review-cadence status for the current repo.

Human-eval build plan Session 33. Command-line counterpart to the
`/dashboard/cadence/overview` hub. Reads artifact timestamps off disk
and prints each cadence's target interval, last completion, and
whether it's on-track / eligible / overdue.

Usage:
    python3 tools/cadence_status.py
    python3 tools/cadence_status.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent

# Keep these in sync with `src/lib/review-cadence-timing.ts`. The TS
# side is the canonical copy because the UI consumes it; this Python
# mirror reuses the same numbers so the CLI and the web hub never
# disagree.
CADENCES = [
    {
        "kind": "weekly",
        "interval_days": 7,
        "grace_days": 3,
        "load_bearing": False,
        "purpose": "Override-stream scan.",
    },
    {
        "kind": "monthly",
        "interval_days": 28,
        "grace_days": 14,
        "load_bearing": False,
        "purpose": "Rotate one of 13 moments for deep-review.",
    },
    {
        "kind": "quarterly",
        "interval_days": 91,
        "grace_days": 21,
        "load_bearing": True,
        "purpose": "Drift check + graduation-threshold recalibration.",
    },
    {
        "kind": "annual",
        "interval_days": 365,
        "grace_days": 60,
        "load_bearing": False,
        "purpose": "Full corpus audit vs the current schema.",
    },
]


@dataclass
class Snapshot:
    kind: str
    interval_days: int
    grace_days: int
    load_bearing: bool
    purpose: str
    last_completed_at: Optional[str]
    next_due_at: Optional[str]
    days_overdue: int
    status: str
    source: str


def _latest_mtime(dir_path: Path, suffix: str) -> Optional[datetime]:
    if not dir_path.exists():
        return None
    files = sorted(
        (p for p in dir_path.iterdir() if p.is_file() and p.name.endswith(suffix)),
        key=lambda p: p.name,
        reverse=True,
    )
    if not files:
        return None
    return datetime.fromtimestamp(files[0].stat().st_mtime, tz=timezone.utc)


def _drift_report_mtime() -> Optional[datetime]:
    return _latest_mtime(REPO_ROOT / "evals" / "drift" / "reports", ".json")


def _annual_report_mtime() -> Optional[datetime]:
    return _latest_mtime(REPO_ROOT / "evals" / "annual_audit" / "reports", ".json")


def _cadence_runs_mtime(kind: str) -> Optional[datetime]:
    """Check `evals/cadence_runs/<kind>/` for a marker of a completed
    cycle. This is the lightweight manual path: drop a dated file in
    the directory when the cycle is done.
    """
    return _latest_mtime(REPO_ROOT / "evals" / "cadence_runs" / kind, ".md")


def _status_for(spec: dict, last: Optional[datetime], now: datetime) -> dict:
    if last is None:
        return {
            "last_completed_at": None,
            "next_due_at": None,
            "days_overdue": 0,
            "status": "eligible",
        }
    next_due = last + timedelta(days=spec["interval_days"])
    overdue_at = next_due + timedelta(days=spec["grace_days"])
    if now < next_due:
        status = "on_track"
    elif now < overdue_at:
        status = "eligible"
    else:
        status = "overdue"
    days_overdue = max(0, (now - next_due).days)
    return {
        "last_completed_at": last.isoformat(),
        "next_due_at": next_due.isoformat(),
        "days_overdue": days_overdue,
        "status": status,
    }


def _source_for(kind: str) -> tuple[Optional[datetime], str]:
    """Return (latest-mtime, source-description) for a cadence."""
    manual = _cadence_runs_mtime(kind)
    if kind in ("monthly", "quarterly"):
        drift = _drift_report_mtime()
        best = _max_dt(manual, drift)
        if best is None:
            return None, "none"
        src = []
        if drift is not None and drift == best:
            src.append("evals/drift/reports/")
        if manual is not None and manual == best:
            src.append(f"evals/cadence_runs/{kind}/")
        return best, " + ".join(src) or "none"
    if kind == "annual":
        annual = _annual_report_mtime()
        best = _max_dt(manual, annual)
        if best is None:
            return None, "none"
        src = []
        if annual is not None and annual == best:
            src.append("evals/annual_audit/reports/")
        if manual is not None and manual == best:
            src.append(f"evals/cadence_runs/{kind}/")
        return best, " + ".join(src) or "none"
    # weekly is implicit — only surfaced via manual markers.
    if manual is None:
        return None, "none"
    return manual, f"evals/cadence_runs/{kind}/"


def _max_dt(a: Optional[datetime], b: Optional[datetime]) -> Optional[datetime]:
    if a is None:
        return b
    if b is None:
        return a
    return max(a, b)


def collect_snapshots(now: Optional[datetime] = None) -> list[Snapshot]:
    now = now or datetime.now(timezone.utc)
    out: list[Snapshot] = []
    for spec in CADENCES:
        last, source = _source_for(spec["kind"])
        status = _status_for(spec, last, now)
        out.append(
            Snapshot(
                kind=spec["kind"],
                interval_days=spec["interval_days"],
                grace_days=spec["grace_days"],
                load_bearing=spec["load_bearing"],
                purpose=spec["purpose"],
                source=source,
                **status,
            )
        )
    return out


def _format_human(snapshots: list[Snapshot]) -> str:
    lines = ["Review cadence status", "=" * 22, ""]
    for s in snapshots:
        tag = "⚠" if s.status == "overdue" else ("•" if s.status == "eligible" else "·")
        hdr = (
            f"{tag} {s.kind.upper():<9}  "
            f"every {s.interval_days}d (grace {s.grace_days}d)  "
            f"{'[load-bearing]' if s.load_bearing else ''}"
        )
        lines.append(hdr)
        lines.append(f"    purpose: {s.purpose}")
        if s.last_completed_at is None:
            lines.append("    last run: never")
        else:
            lines.append(f"    last run: {s.last_completed_at[:10]}  (source: {s.source})")
        if s.next_due_at:
            lines.append(f"    next due: {s.next_due_at[:10]}")
        lines.append(f"    status:   {s.status.upper()}"
                     + (f"  ({s.days_overdue}d overdue)" if s.days_overdue else ""))
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON instead of the human-readable report.",
    )
    args = parser.parse_args()
    snapshots = collect_snapshots()
    if args.json:
        print(json.dumps([asdict(s) for s in snapshots], indent=2))
    else:
        print(_format_human(snapshots))
    return 0


if __name__ == "__main__":
    sys.exit(main())
