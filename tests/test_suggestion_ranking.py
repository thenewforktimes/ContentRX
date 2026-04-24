"""Tests for src/content_checker/suggestion_ranking.py.

Human-eval build plan Session 32. Pure-logic coverage — the ranker
has no DB access, no LLM calls, no I/O.
"""

from __future__ import annotations

import pytest

from content_checker.suggestion_ranking import (
    PreferencePairSignal,
    RankedSuggestion,
    jaccard_similarity,
    rank_suggestions,
    signals_from_export,
)


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


def test_jaccard_handles_empty_inputs():
    assert jaccard_similarity("", "anything") == 0.0
    assert jaccard_similarity("anything", "") == 0.0


def test_jaccard_is_symmetric_and_bounded():
    a, b = "delete the account forever", "delete the file forever"
    s1 = jaccard_similarity(a, b)
    s2 = jaccard_similarity(b, a)
    assert s1 == s2
    assert 0 <= s1 <= 1
    # Non-trivial overlap from "delete" + "the" + "forever".
    assert s1 > 0.2


def test_jaccard_identical_text_is_one():
    assert jaccard_similarity("hello world", "hello world") == 1.0


def test_rank_prefers_candidate_close_to_preferred_side():
    candidates = [
        # Loosely echoes the preferred side of the signal
        "Delete account permanently. You can't undo this.",
        # Echoes the weaker side
        "Are you sure you want to continue?",
        # Neutral third option
        "Proceed to the next step.",
    ]
    ranked = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[_signal()],
    )
    # Candidate 0 should rise; candidate 1 should sink.
    assert ranked[0].original_index == 0
    assert ranked[0].alignment_score > 0
    assert ranked[-1].original_index == 1
    assert ranked[-1].alignment_score < 0


def test_rank_ignores_signals_with_different_standard():
    candidates = ["Delete account permanently.", "Cancel this now"]
    unrelated = _signal(standard_id="TN-01")
    ranked = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[unrelated],
    )
    # Scores should all be zero — no relevant signal.
    for r in ranked:
        assert r.alignment_score == 0.0
        assert r.matched_signal_count == 0


def test_rank_downweights_signal_for_partial_context_match():
    # Same standard but different moment → half-relevance.
    strong_match = _signal(moment="destructive_action", sample_size=5)
    partial_match = _signal(moment="confirmation", sample_size=5)
    candidates = ["Delete account permanently."]

    full = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[strong_match],
    )
    partial = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[partial_match],
    )
    # Partial context match should produce ~half the alignment score.
    assert partial[0].alignment_score < full[0].alignment_score
    assert partial[0].alignment_score > 0


def test_rank_is_stable_for_tied_scores():
    # Two candidates with identical alignment should preserve order.
    candidates = ["first candidate", "second candidate"]
    ranked = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment=None,
        signals=[],
    )
    assert [r.original_index for r in ranked] == [0, 1]
    assert all(r.alignment_score == 0 for r in ranked)


def test_rank_uses_log_weight_for_sample_size():
    few_responses = _signal(sample_size=1)
    many_responses = _signal(sample_size=100)
    candidates = ["Delete account permanently."]

    low = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[few_responses],
    )[0].alignment_score
    high = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[many_responses],
    )[0].alignment_score
    # More responses → more weight, but log so it doesn't blow up.
    assert high > low
    assert high < low * 100  # definitely sub-linear


def test_rank_skips_marginal_signals_under_delta_threshold():
    # Candidate equidistant from both sides of a signal.
    candidates = ["Unrelated copy not matching either side closely."]
    ranked = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[_signal()],
    )
    # Small delta should round out of the score.
    assert ranked[0].alignment_score == 0
    assert ranked[0].matched_signal_count == 0


def test_rank_records_reasons_for_matched_signals():
    candidates = ["Delete account permanently. This is irreversible."]
    ranked = rank_suggestions(
        candidates,
        standard_id="PRF-01",
        moment="destructive_action",
        signals=[_signal()],
    )
    assert ranked[0].reasons
    assert "PRF-01@destructive_action" in ranked[0].reasons[0]
    assert "+preferred" in ranked[0].reasons[0]


def test_signals_from_export_skips_probes_without_expected():
    export = {
        "items": [
            {
                "pair": {
                    "standard_id": "PRF-01",
                    "moment": "destructive_action",
                    "expected_preferred": None,
                    "left_text": "x",
                    "right_text": "y",
                },
                "responses": [{"preferred": "left"}],
            }
        ]
    }
    assert signals_from_export(export) == []


def test_signals_from_export_extracts_preferred_side():
    export = {
        "items": [
            {
                "pair": {
                    "standard_id": "PRF-01",
                    "moment": "destructive_action",
                    "expected_preferred": "left",
                    "left_text": "Delete forever",
                    "right_text": "Continue",
                },
                "responses": [
                    {"preferred": "left"},
                    {"preferred": "left"},
                    {"preferred": "right"},
                ],
            },
            {
                "pair": {
                    "standard_id": "TN-01",
                    "moment": "wayfinding",
                    "expected_preferred": "right",
                    "left_text": "The Billing Center",
                    "right_text": "Billing",
                },
                "responses": [
                    {"preferred": "right"},
                ],
            },
        ]
    }
    signals = signals_from_export(export)
    assert len(signals) == 2
    assert signals[0].standard_id == "PRF-01"
    assert signals[0].preferred_text == "Delete forever"
    assert signals[0].non_preferred_text == "Continue"
    assert signals[0].sample_size == 2
    assert signals[1].standard_id == "TN-01"
    assert signals[1].preferred_text == "Billing"


def test_signals_from_export_respects_min_sample_size():
    export = {
        "items": [
            {
                "pair": {
                    "standard_id": "PRF-01",
                    "moment": "destructive_action",
                    "expected_preferred": "left",
                    "left_text": "Delete forever",
                    "right_text": "Continue",
                },
                "responses": [{"preferred": "right"}],  # 0 aligned
            }
        ]
    }
    assert signals_from_export(export, min_sample_size=1) == []


def test_ranked_suggestion_round_trips_through_dataclass():
    r = RankedSuggestion(text="t", original_index=0)
    assert r.alignment_score == 0.0
    assert r.reasons == []
