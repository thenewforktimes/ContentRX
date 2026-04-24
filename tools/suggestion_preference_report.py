"""Preference-vs-suggestion agreement report.

Human-eval build plan Session 32 success criterion: "Counterfactual-
suggestion quality improves measurably on a held-out eval set once
preference data is incorporated." This tool is the measurement
instrument — it takes the preference export (Session 31) plus an
annotated eval file whose cases carry both original suggestions and
the emit-order they landed in, and reports:

  - Per-moment agreement: fraction of cases where the top candidate
    after `rank_suggestions` matches the one the annotator picked.
  - Signal coverage: how many candidates had at least one matching
    preference signal.
  - Baseline: what fraction would agree if we did no re-ranking.

Designed to run against a held-out set so the same cases evaluate
apples-to-apples before and after preferences are folded in.

Usage:
    python3 tools/suggestion_preference_report.py \\
        --preferences evals/preferences_export.json \\
        --cases evals/suggestion_quality/held_out.json \\
        --output evals/suggestion_quality/report.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from content_checker.suggestion_ranking import (
    rank_suggestions,
    signals_from_export,
)


def load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def analyse_cases(cases: list[dict], signals: list) -> dict:
    """Return the per-moment agreement report.

    Each case is expected to have:
      - `moment`: str | null
      - `standard_id`: str
      - `candidates`: list[str] — the suggestions the generator emitted
      - `chosen_candidate_index`: int — the one the annotator picked
        as correct for this case. That's the ground-truth pointer.

    Cases missing any of these fields are skipped and counted in
    `skipped`.
    """
    per_moment: dict[str, dict] = defaultdict(
        lambda: {
            "cases": 0,
            "baseline_agree": 0,
            "ranked_agree": 0,
            "candidates_with_signal": 0,
            "candidates_total": 0,
        }
    )
    skipped = 0
    global_report = {
        "cases": 0,
        "baseline_agree": 0,
        "ranked_agree": 0,
        "candidates_with_signal": 0,
        "candidates_total": 0,
    }

    for case in cases:
        candidates = case.get("candidates") or []
        gold = case.get("chosen_candidate_index")
        std = case.get("standard_id")
        if not candidates or gold is None or std is None:
            skipped += 1
            continue
        if not (0 <= gold < len(candidates)):
            skipped += 1
            continue

        moment = case.get("moment") or "unknown"

        ranked = rank_suggestions(
            candidates,
            standard_id=std,
            moment=case.get("moment"),
            signals=signals,
        )
        baseline_top = 0  # the generator's own first candidate
        ranked_top = ranked[0].original_index

        per_moment[moment]["cases"] += 1
        per_moment[moment]["candidates_total"] += len(candidates)
        per_moment[moment]["candidates_with_signal"] += sum(
            1 for r in ranked if r.matched_signal_count > 0
        )
        if baseline_top == gold:
            per_moment[moment]["baseline_agree"] += 1
        if ranked_top == gold:
            per_moment[moment]["ranked_agree"] += 1

        global_report["cases"] += 1
        global_report["candidates_total"] += len(candidates)
        global_report["candidates_with_signal"] += sum(
            1 for r in ranked if r.matched_signal_count > 0
        )
        if baseline_top == gold:
            global_report["baseline_agree"] += 1
        if ranked_top == gold:
            global_report["ranked_agree"] += 1

    def _finalise(d: dict) -> dict:
        n = d["cases"]
        return {
            "cases": n,
            "baseline_agreement_rate": round(d["baseline_agree"] / n, 4) if n else 0,
            "ranked_agreement_rate": round(d["ranked_agree"] / n, 4) if n else 0,
            "delta": round(
                (d["ranked_agree"] - d["baseline_agree"]) / n, 4
            )
            if n
            else 0,
            "candidate_signal_coverage": round(
                d["candidates_with_signal"] / d["candidates_total"], 4
            )
            if d["candidates_total"]
            else 0,
        }

    return {
        "overall": _finalise(global_report),
        "per_moment": {k: _finalise(v) for k, v in sorted(per_moment.items())},
        "cases_analysed": global_report["cases"],
        "cases_skipped": skipped,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--preferences", "-p",
        required=True,
        help="Path to /api/preferences/export dump (JSON).",
    )
    parser.add_argument(
        "--cases", "-c",
        required=True,
        help="Path to held-out eval cases with candidates + gold pick.",
    )
    parser.add_argument(
        "--output", "-o",
        help="Write report JSON to this path (default: stdout).",
    )
    parser.add_argument(
        "--min-sample-size",
        type=int,
        default=1,
        help="Drop preference pairs with fewer aligned responses than this.",
    )
    args = parser.parse_args()

    prefs_path = Path(args.preferences)
    cases_path = Path(args.cases)
    if not prefs_path.exists():
        print(f"error: preferences file not found: {prefs_path}", file=sys.stderr)
        return 2
    if not cases_path.exists():
        print(f"error: cases file not found: {cases_path}", file=sys.stderr)
        return 2

    export = load_json(prefs_path)
    cases_data = load_json(cases_path)
    cases = cases_data.get("cases", cases_data if isinstance(cases_data, list) else [])

    signals = signals_from_export(export, min_sample_size=args.min_sample_size)
    report = analyse_cases(cases, signals)
    report["signals_loaded"] = len(signals)
    report["preferences_source"] = str(prefs_path)
    report["cases_source"] = str(cases_path)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"Wrote report to {out_path}", file=sys.stderr)
    else:
        print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
