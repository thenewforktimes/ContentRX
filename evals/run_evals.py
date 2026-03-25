"""Eval runner for the content standards checker.

Tests every standard in the library against its correct and incorrect examples.
Runs multiple passes to measure stability.

Usage:
    python -m evals.run_evals                  # 3 runs, library cases
    python -m evals.run_evals --novel          # novel (generalization) cases
    python -m evals.run_evals --novel --runs 5 # novel cases, 5 runs
    python -m evals.run_evals --category TRN   # only one category prefix
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from content_checker import check, check_unfiltered, load_standards

SCRIPT_DIR = Path(__file__).parent
NOVEL_CASES_PATH = SCRIPT_DIR / "novel_cases.json"


# ---------------------------------------------------------------------------
# Test case builders
# ---------------------------------------------------------------------------


def build_library_cases(
    standards_data: dict,
    category_filter: str | None = None,
    new_only: bool = False,
    include_all: bool = False,
) -> tuple[list[dict], list[str]]:
    """Build test cases from the standards library.

    Each standard produces 2 cases: correct (expect pass) + incorrect (expect fail).
    """
    cases = []
    skipped = []

    for cat in standards_data["categories"]:
        for std in cat["standards"]:
            if category_filter and not std["id"].startswith(category_filter):
                continue
            if new_only and "sources" not in std:
                continue
            if not include_all and std.get("checkable_from", "plain_text") != "plain_text":
                skipped.append(f"{std['id']} ({std.get('checkable_from', 'unknown')})")
                continue

            for label, text_key, expected in [("correct", "correct", "pass"), ("incorrect", "incorrect", "fail")]:
                cases.append({
                    "case_id": f"{std['id']} {label}",
                    "standard_id": std["id"],
                    "input": std[text_key],
                    "expected": expected,
                    "category": cat["name"],
                })

    return cases, skipped


def load_novel_cases(
    category_filter: str | None = None,
    standards_data: dict | None = None,
) -> list[dict]:
    """Load novel test cases from novel_cases.json.

    Each case should have a content_type field. Falls back to deriving
    from the standard's relevant_content_types if missing.
    """
    if not NOVEL_CASES_PATH.exists():
        print(f"Novel cases file not found: {NOVEL_CASES_PATH}")
        return []

    with open(NOVEL_CASES_PATH) as f:
        data = json.load(f)

    type_lookup: dict[str, str] = {}
    if standards_data:
        for cat in standards_data["categories"]:
            for std in cat["standards"]:
                relevant = std.get("relevant_content_types", [])
                type_lookup[std["id"]] = relevant[0] if relevant else "short_ui_copy"

    cases = []
    for case in data["cases"]:
        if category_filter and not case["standard_id"].startswith(category_filter):
            continue
        cases.append({
            "case_id": case["case_id"],
            "standard_id": case["standard_id"],
            "input": case["input"],
            "expected": case["expected"],
            "category": case["category"],
            "content_type": case.get("content_type") or type_lookup.get(case["standard_id"], "short_ui_copy"),
        })
    return cases


# ---------------------------------------------------------------------------
# Eval execution
# ---------------------------------------------------------------------------


def run_single_eval(
    cases: list[dict],
    model: str,
    run_number: int,
    total_runs: int,
    novel: bool = False,
) -> list[dict]:
    """Run one pass of all test cases."""
    results = []
    total = len(cases)

    for i, case in enumerate(cases, 1):
        label = f"[Run {run_number}/{total_runs}] [{i}/{total}] {case['case_id']}"
        print(f"  {label}...", end=" ", flush=True)

        try:
            if novel:
                result, latency, tokens = check(
                    case["input"],
                    content_type=case.get("content_type"),
                    model=model,
                )
            else:
                result, latency, tokens = check_unfiltered(
                    case["input"],
                    model=model,
                )

            verdict = result.overall_verdict
            correct = verdict == case["expected"]

            standard_id_match = None
            if case["expected"] == "fail" and verdict == "fail":
                cited_ids = [v.standard_id for v in result.violations]
                standard_id_match = case["standard_id"] in cited_ids

            icon = "✓" if correct else "✗"
            color = "\033[32m" if correct else "\033[31m"
            print(f"{color}{icon}\033[0m  verdict={verdict} expected={case['expected']} ({latency:.1f}s)")

            results.append({
                "case_id": case["case_id"],
                "standard_id": case["standard_id"],
                "category": case["category"],
                "input": case["input"],
                "expected": case["expected"],
                "actual": verdict,
                "correct": correct,
                "standard_id_match": standard_id_match,
                "latency": latency,
                "tokens": tokens.to_dict(),
            })

        except Exception as e:
            print(f"\033[31m✗ ERROR: {e}\033[0m")
            results.append({
                "case_id": case["case_id"],
                "standard_id": case["standard_id"],
                "category": case["category"],
                "input": case["input"],
                "expected": case["expected"],
                "actual": "error",
                "correct": False,
                "standard_id_match": None,
                "latency": 0,
                "tokens": {"input": 0, "output": 0},
                "error": str(e),
            })

    return results


# ---------------------------------------------------------------------------
# Metrics and reporting
# ---------------------------------------------------------------------------


def compute_metrics(all_runs: list[list[dict]], cases: list[dict]) -> dict:
    """Compute aggregate metrics across all runs."""
    run_accuracies = []
    stability: dict = {}
    total_latency = 0.0
    total_input_tokens = 0
    total_output_tokens = 0
    total_checks = 0

    for case in cases:
        stability[case["case_id"]] = {
            "outcomes": [],
            "input": case["input"],
            "expected": case["expected"],
        }

    for run_results in all_runs:
        correct_count = sum(1 for r in run_results if r["correct"])
        run_accuracies.append(correct_count / len(run_results))

        for r in run_results:
            stability[r["case_id"]]["outcomes"].append(r["correct"])
            total_latency += r["latency"]
            total_input_tokens += r["tokens"]["input"]
            total_output_tokens += r["tokens"]["output"]
            total_checks += 1

    for data in stability.values():
        times_correct = sum(data["outcomes"])
        times_wrong = len(data["outcomes"]) - times_correct
        if times_wrong == 0:
            data["status"] = "stable_pass"
        elif times_correct == 0:
            data["status"] = "stable_fail"
        else:
            data["status"] = "unstable"
        data["times_correct"] = times_correct
        data["times_wrong"] = times_wrong

    stable_passes = sum(1 for d in stability.values() if d["status"] == "stable_pass")
    stable_fails = sum(1 for d in stability.values() if d["status"] == "stable_fail")
    unstable = sum(1 for d in stability.values() if d["status"] == "unstable")

    pass_cases_total = 0
    false_positives = 0
    for run_results in all_runs:
        for r in run_results:
            if r["expected"] == "pass":
                pass_cases_total += 1
                if r["actual"] == "fail":
                    false_positives += 1

    id_checks_total = 0
    id_checks_correct = 0
    for run_results in all_runs:
        for r in run_results:
            if r["standard_id_match"] is not None:
                id_checks_total += 1
                if r["standard_id_match"]:
                    id_checks_correct += 1

    estimated_cost = (total_input_tokens / 1_000_000 * 3) + (total_output_tokens / 1_000_000 * 15)

    return {
        "run_accuracies": run_accuracies,
        "average_accuracy": sum(run_accuracies) / len(run_accuracies),
        "stable_passes": stable_passes,
        "stable_fails": stable_fails,
        "unstable": unstable,
        "total_cases": len(cases),
        "false_positives": false_positives,
        "false_positive_rate": false_positives / pass_cases_total if pass_cases_total > 0 else 0,
        "standard_id_accuracy": id_checks_correct / id_checks_total if id_checks_total > 0 else None,
        "average_latency": total_latency / total_checks if total_checks > 0 else 0,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "estimated_cost_usd": estimated_cost,
        "stability": stability,
    }


def write_reports(metrics: dict, model: str, num_runs: int, output_dir: str) -> Path:
    """Write markdown and JSON reports."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    md = f"""# Stability report: {num_runs} eval runs

**Date:** {now}
**Model:** {model}
**Cases:** {metrics['total_cases']}

## Per-run accuracy

"""
    for i, acc in enumerate(metrics["run_accuracies"], 1):
        md += f"- Run {i}: {acc * 100:.1f}%\n"
    md += f"- Average: {metrics['average_accuracy'] * 100:.1f}%\n"

    md += f"""
## Stability

- Stable passes (correct every time): {metrics['stable_passes']}/{metrics['total_cases']}
- Stable fails (wrong every time): {metrics['stable_fails']}/{metrics['total_cases']}
- Unstable (flipped between runs): {metrics['unstable']}/{metrics['total_cases']}

## Quality metrics

- False positives: {metrics['false_positives']}
- False positive rate: {metrics['false_positive_rate'] * 100:.1f}%
- Standard ID accuracy: {f"{metrics['standard_id_accuracy'] * 100:.1f}%" if metrics['standard_id_accuracy'] is not None else "N/A"}

## Performance

- Average latency: {metrics['average_latency']:.1f}s per check
- Total tokens: {metrics['total_input_tokens']:,} input / {metrics['total_output_tokens']:,} output
- Estimated cost: ${metrics['estimated_cost_usd']:.2f}
"""

    unstable_cases = {k: v for k, v in metrics["stability"].items() if v["status"] == "unstable"}
    if unstable_cases:
        md += "\n## Unstable cases\n\n"
        for case_id, data in unstable_cases.items():
            md += f"- **{case_id}**: correct {data['times_correct']}/{data['times_correct'] + data['times_wrong']} times\n"
            md += f"  - Input: \"{data['input']}\"\n"
            md += f"  - Expected: {data['expected']}\n"

    (out / "stability_report.md").write_text(md)

    json_report = {
        "run_accuracies": metrics["run_accuracies"],
        "average_accuracy": metrics["average_accuracy"],
        "false_positive_rate": metrics["false_positive_rate"],
        "standard_id_accuracy": metrics["standard_id_accuracy"],
        "average_latency": metrics["average_latency"],
        "estimated_cost_usd": metrics["estimated_cost_usd"],
        "stability": metrics["stability"],
    }
    (out / "stability_report.json").write_text(json.dumps(json_report, indent=2))

    return out / "stability_report.md"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="Run evals for the content standards checker.")
    parser.add_argument("--runs", type=int, default=3, help="Number of eval runs (default: 3)")
    parser.add_argument("--model", default="claude-sonnet-4-20250514", help="Model to use")
    parser.add_argument("--novel", action="store_true", help="Run novel test cases")
    parser.add_argument("--new-only", action="store_true", help="Only standards with 'sources' field")
    parser.add_argument("--category", help="Only test standards with this ID prefix")
    parser.add_argument("--all", action="store_true", dest="include_all", help="Include rich_text/visual standards")
    parser.add_argument("--output", default=None, help="Output directory")
    args = parser.parse_args()

    output_dir = args.output or str(SCRIPT_DIR / "results")

    print("Content standards checker — eval runner")
    print(f"Model: {args.model}")
    print(f"Runs: {args.runs}")

    standards_data = load_standards()

    if args.novel:
        print("Mode: novel (generalization) cases")
        cases = load_novel_cases(category_filter=args.category, standards_data=standards_data)
        skipped: list[str] = []
    else:
        print("Mode: library cases (unfiltered)")
        cases, skipped = build_library_cases(
            standards_data,
            category_filter=args.category,
            new_only=args.new_only,
            include_all=args.include_all,
        )

    if not cases:
        print("No test cases matched the filters.")
        return

    if args.novel:
        unique = len(set(c["standard_id"] for c in cases))
        print(f"Test cases: {len(cases)} novel cases across {unique} standards")
    else:
        print(f"Test cases: {len(cases)} ({len(cases) // 2} standards × 2 examples)")
    if skipped:
        print(f"Skipped: {', '.join(skipped)}")
    print()

    all_runs = []
    for run_num in range(1, args.runs + 1):
        print(f"── Run {run_num}/{args.runs} ──")
        results = run_single_eval(cases, args.model, run_num, args.runs, novel=args.novel)
        all_runs.append(results)
        correct = sum(1 for r in results if r["correct"])
        print(f"  Run {run_num} accuracy: {correct}/{len(results)} ({correct / len(results) * 100:.1f}%)\n")

    metrics = compute_metrics(all_runs, cases)
    report_path = write_reports(metrics, args.model, args.runs, output_dir)

    print("── Summary ──")
    print(f"Average accuracy: {metrics['average_accuracy'] * 100:.1f}%")
    print(f"Stable passes: {metrics['stable_passes']}/{metrics['total_cases']}")
    print(f"Unstable: {metrics['unstable']}/{metrics['total_cases']}")
    print(f"False positive rate: {metrics['false_positive_rate'] * 100:.1f}%")
    if metrics["standard_id_accuracy"] is not None:
        print(f"Standard ID accuracy: {metrics['standard_id_accuracy'] * 100:.1f}%")
    print(f"Average latency: {metrics['average_latency']:.1f}s")
    print(f"Estimated cost: ${metrics['estimated_cost_usd']:.2f}")
    print(f"\nReports written to: {report_path.parent}")


if __name__ == "__main__":
    main()
