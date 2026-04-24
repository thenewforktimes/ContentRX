"""Tests for the Session 10 graduation-metrics tool.

Covers every one of the six criteria at the function boundary — no
CLI-round-trip tests, since the CLI is a thin shell over these
functions.
"""

from __future__ import annotations

import datetime as _dt
import sys
from pathlib import Path

import pytest

TOOLS_DIR = Path(__file__).resolve().parent.parent / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import graduation_metrics as gm  # noqa: E402


# ═══════════════════════════════════════════════════════════════════════
# Statistics primitives
# ═══════════════════════════════════════════════════════════════════════


class TestComputeKappa:
    def test_perfect_agreement(self):
        pairs = [("pass", "pass"), ("fail", "fail"), ("pass", "pass")]
        assert gm.compute_kappa(pairs) == pytest.approx(1.0)

    def test_chance_agreement_is_zero(self):
        pairs = [("pass", "pass"), ("pass", "fail"),
                 ("fail", "pass"), ("fail", "fail")]
        assert gm.compute_kappa(pairs) == pytest.approx(0.0)

    def test_too_few_pairs(self):
        assert gm.compute_kappa([]) is None
        assert gm.compute_kappa([("pass", "pass")]) is None

    def test_perfect_marginals_undefined(self):
        pairs = [("pass", "pass")] * 10
        assert gm.compute_kappa(pairs) is None


class TestRawAgreement:
    def test_basic(self):
        pairs = [("pass", "pass"), ("fail", "pass")]
        assert gm.compute_raw_agreement(pairs) == 0.5

    def test_empty_is_none(self):
        assert gm.compute_raw_agreement([]) is None


class TestComputeMcc:
    def test_perfect_positive_correlation(self):
        # All tp + tn; no fp or fn → MCC = 1.
        pairs = [("fail", "fail")] * 5 + [("pass", "pass")] * 5
        assert gm.compute_mcc(pairs) == pytest.approx(1.0)

    def test_perfect_negative_correlation(self):
        # Every human=fail paired with machine=pass, and vice versa → MCC = -1.
        pairs = [("fail", "pass")] * 5 + [("pass", "fail")] * 5
        assert gm.compute_mcc(pairs) == pytest.approx(-1.0)

    def test_skewed_marginals_undefined(self):
        # All human+machine = pass → tp + fp = 0 → denom 0.
        pairs = [("pass", "pass")] * 10
        assert gm.compute_mcc(pairs) is None


class TestPrevalence:
    def test_counts_positives(self):
        cases = [
            {"human_verdict": "fail"}, {"human_verdict": "fail"},
            {"human_verdict": "pass"}, {"human_verdict": "pass"},
            {"human_verdict": "pass"},
        ]
        assert gm.compute_prevalence(cases) == pytest.approx(0.4)

    def test_skips_non_binary_verdicts(self):
        cases = [
            {"human_verdict": "fail"}, {"human_verdict": "pending"},
            {"human_verdict": "pass"},
        ]
        # 1 fail / 2 binary = 0.5.
        assert gm.compute_prevalence(cases) == pytest.approx(0.5)

    def test_empty_is_none(self):
        assert gm.compute_prevalence([]) is None


# ═══════════════════════════════════════════════════════════════════════
# Counterpart tier + variation
# ═══════════════════════════════════════════════════════════════════════


class TestCounterpartTier:
    def test_low_prevalence_uses_5(self):
        assert gm.counterpart_tier(0.05) == 5
        assert gm.counterpart_tier(0.14) == 5

    def test_mid_prevalence_uses_8(self):
        assert gm.counterpart_tier(0.15) == 8
        assert gm.counterpart_tier(0.40) == 8

    def test_high_prevalence_uses_12(self):
        assert gm.counterpart_tier(0.41) == 12
        assert gm.counterpart_tier(0.90) == 12

    def test_structurally_complex_adds_three(self):
        assert gm.counterpart_tier(0.10, structurally_complex=True) == 8
        assert gm.counterpart_tier(0.50, structurally_complex=True) == 15


class TestCounterpartVariation:
    def test_empty_fails(self):
        r = gm.counterpart_variation(
            [], primary_moment="error_recovery",
            primary_content_type="error_message",
        )
        assert r["passes"] is False

    def test_only_within_moment_fails(self):
        # All 5 counterparts in the same moment+content_type bucket →
        # axes_represented = 1 < 2.
        counterparts = [
            {"moment": "error_recovery", "content_type": "error_message"}
        ] * 5
        r = gm.counterpart_variation(
            counterparts, primary_moment="error_recovery",
            primary_content_type="error_message",
        )
        assert r["axes_represented"] == 1
        assert r["passes"] is False

    def test_within_moment_mandatory(self):
        # No within-moment cases → violation fires even if axes ≥ 2.
        counterparts = [
            {"moment": "browsing_discovery", "content_type": "heading"},
            {"moment": "browsing_discovery", "content_type": "short_ui_copy"},
            {"moment": "celebration", "content_type": "short_ui_copy"},
        ]
        r = gm.counterpart_variation(
            counterparts, primary_moment="error_recovery",
            primary_content_type="error_message",
        )
        assert any("within-moment axis empty" in v for v in r["violations"])

    def test_passes_when_all_thresholds_met(self):
        # 6 within-moment-within-type, 3 cross-CT, 1 cross-moment → 60/30/10.
        counterparts = (
            [{"moment": "M", "content_type": "CT"}] * 6
            + [{"moment": "M", "content_type": "OTHER"}] * 3
            + [{"moment": "OTHER-M", "content_type": "CT"}]
        )
        r = gm.counterpart_variation(
            counterparts, primary_moment="M", primary_content_type="CT",
        )
        assert r["passes"] is True
        assert r["axes_represented"] == 3


class TestCounterpartPassRate:
    def test_all_correct(self):
        cps = [{"case_id": "c1"}, {"case_id": "c2"}]
        verdicts = {"c1": "pass", "c2": "pass"}
        assert gm.counterpart_pass_rate(cps, verdicts) == 1.0

    def test_mixed(self):
        cps = [{"case_id": "c1"}, {"case_id": "c2"}, {"case_id": "c3"}]
        verdicts = {"c1": "pass", "c2": "fail", "c3": "pass"}
        assert gm.counterpart_pass_rate(cps, verdicts) == pytest.approx(2 / 3)

    def test_missing_verdict_counts_as_fail(self):
        cps = [{"case_id": "c1"}, {"case_id": "c2"}]
        verdicts = {"c1": "pass"}  # c2 missing → not pass
        assert gm.counterpart_pass_rate(cps, verdicts) == 0.5

    def test_empty_is_none(self):
        assert gm.counterpart_pass_rate([], {}) is None


# ═══════════════════════════════════════════════════════════════════════
# Rule-version credit policy
# ═══════════════════════════════════════════════════════════════════════


class TestRuleVersionCredit:
    def test_none_means_full_credit(self):
        cps = [{"case_id": "c1"}, {"case_id": "c2"}]
        kept, weight = gm.apply_rule_version_credit(cps, change_kind=None)
        assert kept == cps
        assert weight == 1.0

    def test_semantic_resets_to_zero(self):
        cps = [{"case_id": "c1"}, {"case_id": "c2"}]
        kept, weight = gm.apply_rule_version_credit(
            cps, change_kind=gm.RULE_VERSION_SEMANTIC,
        )
        assert kept == []
        assert weight == 0.0

    def test_wording_keeps_all_at_half_weight(self):
        cps = [{"case_id": "c1"}, {"case_id": "c2"}]
        kept, weight = gm.apply_rule_version_credit(
            cps, change_kind=gm.RULE_VERSION_WORDING,
        )
        assert kept == cps
        assert weight == 0.5

    def test_additive_drops_affected_cases(self):
        cps = [
            {"case_id": "c1"}, {"case_id": "c2"}, {"case_id": "c3"},
        ]
        kept, weight = gm.apply_rule_version_credit(
            cps, change_kind=gm.RULE_VERSION_ADDITIVE,
            change_affects={"c2"},
        )
        assert {k["case_id"] for k in kept} == {"c1", "c3"}
        assert weight == 1.0

    def test_unknown_change_is_conservative_reset(self):
        cps = [{"case_id": "c1"}]
        kept, weight = gm.apply_rule_version_credit(
            cps, change_kind="something_else",
        )
        assert kept == []
        assert weight == 0.0


# ═══════════════════════════════════════════════════════════════════════
# Stability window
# ═══════════════════════════════════════════════════════════════════════


def _iso(when: _dt.datetime) -> str:
    return when.replace(tzinfo=_dt.timezone.utc).isoformat().replace("+00:00", "Z")


class TestBucketReviewsByWeek:
    def test_places_events_in_right_bucket(self):
        end = _dt.date(2026, 4, 23)
        # Event from 3 days ago → should land in the last bucket (index 3).
        reviews = [
            {"timestamp": _iso(_dt.datetime(2026, 4, 20, 12, 0))},
        ]
        buckets = gm.bucket_reviews_by_week(reviews, end_date=end, weeks=4)
        # 4 buckets, only last should have an event.
        assert [len(b) for b in buckets] == [0, 0, 0, 1]

    def test_ignores_events_outside_window(self):
        end = _dt.date(2026, 4, 23)
        reviews = [
            # 5 weeks back
            {"timestamp": _iso(_dt.datetime(2026, 3, 1, 0, 0))},
        ]
        buckets = gm.bucket_reviews_by_week(reviews, end_date=end, weeks=4)
        assert all(len(b) == 0 for b in buckets)


class TestStableAbove:
    def test_all_above(self):
        assert gm.stable_above([0.9, 0.91, 0.92, 0.93], 0.85) is True

    def test_one_below_fails(self):
        assert gm.stable_above([0.9, 0.84, 0.91, 0.92], 0.85) is False

    def test_none_value_fails(self):
        assert gm.stable_above([0.9, None, 0.9, 0.9], 0.85) is False

    def test_empty_fails(self):
        assert gm.stable_above([], 0.85) is False


# ═══════════════════════════════════════════════════════════════════════
# assess_standard — end-to-end composition
# ═══════════════════════════════════════════════════════════════════════


def _review(standard_id, human, machine, when: _dt.datetime | None = None):
    return {
        "standard_id": standard_id,
        "human_verdict": human,
        "machine_verdict": machine,
        "timestamp": _iso(when or _dt.datetime(2026, 4, 20, 12, 0)),
    }


class TestAssessStandard:
    def test_insufficient_sample_cannot_graduate(self):
        reviews = [_review("CLR-01", "fail", "fail") for _ in range(50)]
        r = gm.assess_standard(
            "CLR-01",
            reviews=reviews,
            overrides=[],
            total_verdicts=50,
            novel_counterparts=[],
            counterpart_engine_verdicts={},
            prevalence=0.3,
            end_date=_dt.date(2026, 4, 23),
        )
        assert r["recommended_level"] == gm.LEVEL_ROBO_LABELS
        assert r["batch_approval"]["eligible"] is False

    def test_high_kappa_without_counterparts_still_blocked(self):
        # 300 agreements all confirming → κ=1.0, raw agreement=1.0,
        # override rate 0. But zero counterparts → blocked.
        reviews = (
            [_review("CLR-01", "fail", "fail") for _ in range(200)]
            + [_review("CLR-01", "pass", "pass") for _ in range(100)]
        )
        r = gm.assess_standard(
            "CLR-01",
            reviews=reviews,
            overrides=[],
            total_verdicts=300,
            novel_counterparts=[],
            counterpart_engine_verdicts={},
            prevalence=0.30,
            end_date=_dt.date(2026, 4, 23),
        )
        # Hard-gate: counterparts missing → no graduation.
        assert r["recommended_level"] == gm.LEVEL_ROBO_LABELS
        assert r["batch_approval"]["criteria"]["counterparts"]["pass"] is False

    def test_mcc_needed_when_prevalence_low(self):
        reviews = [_review("CLR-01", "fail", "fail") for _ in range(300)]
        r = gm.assess_standard(
            "CLR-01",
            reviews=reviews,
            overrides=[],
            total_verdicts=300,
            novel_counterparts=[],
            counterpart_engine_verdicts={},
            prevalence=0.05,  # < 15% → MCC required
            end_date=_dt.date(2026, 4, 23),
        )
        assert r["batch_approval"]["criteria"]["mcc"]["needed"] is True

    def test_sample_tightening_kicks_in_at_150(self):
        reviews = [_review("CLR-01", "fail", "fail") for _ in range(150)]
        r = gm.assess_standard(
            "CLR-01",
            reviews=reviews,
            overrides=[],
            total_verdicts=150,
            novel_counterparts=[],
            counterpart_engine_verdicts={},
            prevalence=0.3,
            end_date=_dt.date(2026, 4, 23),
        )
        # 100 ≤ 150 < 200 → +0.02 on κ threshold for both levels.
        assert r["batch_approval"]["criteria"]["sample_size"]["tighten_applied"] is True

    def test_kappa_threshold_scales_with_ceiling(self):
        reviews = [_review("CLR-01", "fail", "fail")] * 10
        r_high = gm.assess_standard(
            "CLR-01",
            reviews=reviews, overrides=[], total_verdicts=10,
            novel_counterparts=[], counterpart_engine_verdicts={},
            prevalence=0.3, measured_ceiling=0.95,
            end_date=_dt.date(2026, 4, 23),
        )
        r_low = gm.assess_standard(
            "CLR-01",
            reviews=reviews, overrides=[], total_verdicts=10,
            novel_counterparts=[], counterpart_engine_verdicts={},
            prevalence=0.3, measured_ceiling=0.80,
            end_date=_dt.date(2026, 4, 23),
        )
        high_kappa = r_high["autonomous"]["criteria"]["kappa"]["threshold"]
        low_kappa = r_low["autonomous"]["criteria"]["kappa"]["threshold"]
        assert high_kappa > low_kappa

    def test_actor_role_weighting_affects_override_rate(self):
        # Designer > engineer in weight → same count should produce
        # higher weighted-rate with designer actors.
        override_designer = [
            {"standard_id": "CLR-01", "actor_role": "designer"}
            for _ in range(5)
        ]
        override_engineer = [
            {"standard_id": "CLR-01", "actor_role": "engineer"}
            for _ in range(5)
        ]
        r_designer = gm.assess_standard(
            "CLR-01",
            reviews=[], overrides=override_designer, total_verdicts=100,
            novel_counterparts=[], counterpart_engine_verdicts={},
            prevalence=0.3, end_date=_dt.date(2026, 4, 23),
        )
        r_engineer = gm.assess_standard(
            "CLR-01",
            reviews=[], overrides=override_engineer, total_verdicts=100,
            novel_counterparts=[], counterpart_engine_verdicts={},
            prevalence=0.3, end_date=_dt.date(2026, 4, 23),
        )
        assert (
            r_designer["autonomous"]["criteria"]["override_rate"]["value"]
            > r_engineer["autonomous"]["criteria"]["override_rate"]["value"]
        )

    def test_hard_gate_any_failure_blocks(self):
        # 500 perfect agreements, 10 counterparts, 100% pass rate,
        # BUT override rate is 20% — should block.
        reviews = [_review("CLR-01", "fail", "fail") for _ in range(500)]
        overrides = [
            {"standard_id": "CLR-01", "actor_role": "other"}
            for _ in range(100)
        ]
        counterparts = [
            {"case_id": f"c{i}", "moment": "M", "content_type": "CT"}
            for i in range(10)
        ]
        engine_verdicts = {f"c{i}": "pass" for i in range(10)}
        r = gm.assess_standard(
            "CLR-01",
            reviews=reviews,
            overrides=overrides,
            total_verdicts=500,
            novel_counterparts=counterparts,
            counterpart_engine_verdicts=engine_verdicts,
            prevalence=0.3,
            primary_moment="M",
            primary_content_type="CT",
            end_date=_dt.date(2026, 4, 23),
        )
        # Override rate = 100 (weighted) / 500 = 20% > 5% autonomous
        # threshold. Must fail at least autonomous.
        assert r["autonomous"]["criteria"]["override_rate"]["pass"] is False

    def test_level_ordering_constants(self):
        # Defensive: the ladder's order matters for downstream UI.
        assert gm.LEVELS_ASC == (
            gm.LEVEL_ROBO_LABELS,
            gm.LEVEL_BATCH_APPROVAL,
            gm.LEVEL_AUTONOMOUS,
        )


# ═══════════════════════════════════════════════════════════════════════
# Session 13 — ensemble disagreement rate (tracked, not gated)
# ═══════════════════════════════════════════════════════════════════════


class TestComputeEnsembleDisagreementRate:
    def test_empty_input_returns_empty_dict(self):
        assert gm.compute_ensemble_disagreement_rate([]) == {}

    def test_counts_proposals_and_rejections_per_standard(self):
        events = [
            {"standard_id": "CLR-01", "scan_proposed": True, "validate_rejected": True},
            {"standard_id": "CLR-01", "scan_proposed": True, "validate_rejected": False},
            {"standard_id": "CLR-01", "scan_proposed": True, "validate_rejected": True},
            {"standard_id": "VT-02", "scan_proposed": True, "validate_rejected": False},
        ]
        r = gm.compute_ensemble_disagreement_rate(events)
        assert r["CLR-01"]["scan_proposals"] == 3
        assert r["CLR-01"]["validate_rejections"] == 2
        assert r["CLR-01"]["disagreement_rate"] == pytest.approx(2 / 3)
        assert r["VT-02"]["scan_proposals"] == 1
        assert r["VT-02"]["validate_rejections"] == 0
        assert r["VT-02"]["disagreement_rate"] == pytest.approx(0.0)

    def test_skips_events_without_standard_id(self):
        events = [
            {"scan_proposed": True, "validate_rejected": True},
            {"standard_id": "", "scan_proposed": True},
            {"standard_id": "CLR-01", "scan_proposed": True, "validate_rejected": True},
        ]
        r = gm.compute_ensemble_disagreement_rate(events)
        assert list(r.keys()) == ["CLR-01"]

    def test_standard_with_no_proposals_has_null_rate(self):
        # A standard that only shows up with `scan_proposed=False`
        # shouldn't divide by zero.
        events = [
            {"standard_id": "CLR-01", "scan_proposed": False, "validate_rejected": False},
        ]
        r = gm.compute_ensemble_disagreement_rate(events)
        # The logic: no proposals → standard never enters the dict because
        # both counters are 0. This is intentional — downstream should
        # render "n/a".
        assert r == {}

    def test_rate_attaches_to_assess_standard_output(self):
        reviews = [_review("CLR-01", "fail", "fail") for _ in range(20)]
        r = gm.assess_standard(
            "CLR-01",
            reviews=reviews,
            overrides=[],
            total_verdicts=20,
            novel_counterparts=[],
            counterpart_engine_verdicts={},
            prevalence=0.3,
            end_date=_dt.date(2026, 4, 23),
            ensemble_disagreement={
                "scan_proposals": 50,
                "validate_rejections": 8,
                "disagreement_rate": 0.16,
            },
        )
        assert r["ensemble_disagreement"]["disagreement_rate"] == pytest.approx(0.16)

    def test_rate_is_none_by_default(self):
        reviews = [_review("CLR-01", "fail", "fail") for _ in range(20)]
        r = gm.assess_standard(
            "CLR-01",
            reviews=reviews,
            overrides=[],
            total_verdicts=20,
            novel_counterparts=[],
            counterpart_engine_verdicts={},
            prevalence=0.3,
            end_date=_dt.date(2026, 4, 23),
        )
        # No events supplied → the field is None, not a fake rate.
        assert r["ensemble_disagreement"] is None
