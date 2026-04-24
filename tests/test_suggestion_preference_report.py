"""Tests for `tools/suggestion_preference_report.py`.

Human-eval build plan Session 32. Pure logic; no file I/O in the
analyse path (the main() CLI handles files).
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from content_checker.suggestion_ranking import PreferencePairSignal
from suggestion_preference_report import analyse_cases  # noqa: E402


def _signal(**overrides) -> PreferencePairSignal:
    base = dict(
        standard_id="PRF-01",
        moment="destructive_action",
        preferred_text="Delete account permanently. This can't be undone.",
        non_preferred_text="Are you sure you want to continue?",
        sample_size=5,
    )
    base.update(overrides)
    return PreferencePairSignal(**base)


def test_agreement_report_on_empty_inputs():
    report = analyse_cases([], [])
    assert report["overall"]["cases"] == 0
    assert report["overall"]["baseline_agreement_rate"] == 0
    assert report["cases_skipped"] == 0


def test_report_skips_malformed_cases():
    cases = [
        {"candidates": ["a", "b"], "chosen_candidate_index": 0},  # no standard_id
        {"standard_id": "PRF-01", "chosen_candidate_index": 0},  # no candidates
        {"standard_id": "PRF-01", "candidates": ["a"], "chosen_candidate_index": 5},  # OOB
    ]
    report = analyse_cases(cases, [])
    assert report["cases_skipped"] == 3
    assert report["cases_analysed"] == 0


def test_report_baseline_uses_generator_first_candidate():
    # First candidate is the gold pick → 100% baseline agreement.
    cases = [
        {
            "standard_id": "PRF-01",
            "moment": "destructive_action",
            "candidates": [
                "gold first answer",
                "weaker alternative here",
            ],
            "chosen_candidate_index": 0,
        },
    ]
    report = analyse_cases(cases, [])
    assert report["overall"]["baseline_agreement_rate"] == 1.0
    assert report["overall"]["ranked_agreement_rate"] == 1.0


def test_report_shows_delta_when_ranking_flips_order():
    # Gold is at index 1. The generator emitted it second, so baseline
    # fails; preference signal pulls it to the top → ranked agrees.
    cases = [
        {
            "standard_id": "PRF-01",
            "moment": "destructive_action",
            "candidates": [
                "Are you sure you want to continue?",
                "Delete account permanently. This is irreversible.",
            ],
            "chosen_candidate_index": 1,
        },
    ]
    signals = [_signal()]
    report = analyse_cases(cases, signals)
    assert report["overall"]["baseline_agreement_rate"] == 0.0
    assert report["overall"]["ranked_agreement_rate"] == 1.0
    assert report["overall"]["delta"] == 1.0


def test_report_buckets_per_moment():
    cases = [
        {
            "standard_id": "PRF-01",
            "moment": "destructive_action",
            "candidates": ["a", "b"],
            "chosen_candidate_index": 0,
        },
        {
            "standard_id": "TN-01",
            "moment": "wayfinding",
            "candidates": ["x", "y"],
            "chosen_candidate_index": 0,
        },
    ]
    report = analyse_cases(cases, [])
    assert set(report["per_moment"].keys()) == {
        "destructive_action",
        "wayfinding",
    }
    for bucket in report["per_moment"].values():
        assert bucket["cases"] == 1


def test_report_tracks_signal_coverage():
    cases = [
        {
            "standard_id": "PRF-01",
            "moment": "destructive_action",
            "candidates": [
                "Delete account permanently.",
                "Are you sure you want to continue?",
            ],
            "chosen_candidate_index": 0,
        },
    ]
    report = analyse_cases(cases, [_signal()])
    # Both candidates echo a side → full coverage.
    assert report["overall"]["candidate_signal_coverage"] == 1.0
