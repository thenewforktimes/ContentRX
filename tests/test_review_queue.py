"""Tests for the Session 8 review queue tools.

Covers:
  - `tools/review_queue.py` — phase detection, ordering, batching,
    calibration sampling.
  - `tools/batch_summary.py` — pattern detection, refinement-log
    drafting.
  - `tools/audience_retest.py` — trigger + keep/drop decision logic.

All tests use synthetic fixtures so the suite runs without the
gitignored industry corpus.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

TOOLS_DIR = Path(__file__).resolve().parent.parent / "tools"
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

import review_queue as rq  # noqa: E402
import batch_summary as bs  # noqa: E402
import audience_retest as ar  # noqa: E402


# ═══════════════════════════════════════════════════════════════════════
# review_queue — phase detection
# ═══════════════════════════════════════════════════════════════════════


def _annotated(std="CLR-01", ct="heading", verdict="pass", conf="high"):
    return {
        "standard_id": std,
        "content_type": ct,
        "human_verdict": verdict,
        "human_confidence": conf,
    }


class TestPrecedentTupleCount:
    def test_counts_only_tuples_with_three_plus(self):
        cases = (
            [_annotated("CLR-01", "heading", "pass")] * 3
            + [_annotated("VT-02", "button_cta", "fail")] * 2
        )
        # CLR-01 tuple clears the bar, VT-02 does not.
        assert rq.precedent_tuple_count(cases) == 1

    def test_skips_cases_missing_fields(self):
        cases = [
            _annotated("CLR-01", "heading", "pass"),
            {"standard_id": None, "content_type": "heading", "human_verdict": "pass"},
            {"human_verdict": "pass"},
        ]
        assert rq.precedent_tuple_count(cases) == 0

    def test_empty_returns_zero(self):
        assert rq.precedent_tuple_count([]) == 0


class TestInferPhase:
    def test_below_500_is_early(self):
        # 499 unique tuples each with 3 precedents → still below 500.
        cases = []
        for i in range(499):
            cases.extend([_annotated(f"STD-{i}", "heading", "pass")] * 3)
        assert rq.infer_phase(cases) == rq.PHASE_EARLY

    def test_at_or_above_500_is_late(self):
        cases = []
        for i in range(500):
            cases.extend([_annotated(f"STD-{i}", "heading", "pass")] * 3)
        assert rq.infer_phase(cases) == rq.PHASE_LATE


# ═══════════════════════════════════════════════════════════════════════
# review_queue — novel-combination marking
# ═══════════════════════════════════════════════════════════════════════


def _cand(case_id="c1", std="CLR-01", ct="heading", moment="wayfinding",
          audience=None, rr=None, pushback=False, created="2026-04-01",
          machine_verdict="fail"):
    payload = {
        "id": case_id, "standard_id": std, "content_type": ct,
        "moment": moment, "audience": audience, "review_reason": rr,
        "created_at": created, "machine_verdict": machine_verdict,
    }
    if pushback:
        payload["_standard_pushback"] = True
    return rq.candidate_from_override(payload)


class TestMarkNovelCombinations:
    def test_marks_cases_without_enough_precedents(self):
        candidates = [_cand("c1", std="CLR-01", ct="heading", machine_verdict="fail")]
        # Only 2 precedents for (CLR-01, heading, fail) — below the 3 floor.
        annotated = [_annotated("CLR-01", "heading", "fail")] * 2
        rq.mark_novel_combinations(candidates, annotated)
        assert candidates[0].is_novel_combination is True

    def test_does_not_mark_well_covered_tuples(self):
        candidates = [_cand("c1", std="CLR-01", ct="heading", machine_verdict="fail")]
        annotated = [_annotated("CLR-01", "heading", "fail")] * 5
        rq.mark_novel_combinations(candidates, annotated)
        assert candidates[0].is_novel_combination is False

    def test_missing_verdict_skips_marking(self):
        # Candidate has no machine_verdict or expected — can't judge.
        c = _cand("c1"); c.payload = {"id": "c1", "standard_id": "X", "content_type": "Y"}
        rq.mark_novel_combinations([c], [])
        assert c.is_novel_combination is False


# ═══════════════════════════════════════════════════════════════════════
# review_queue — ordering
# ═══════════════════════════════════════════════════════════════════════


class TestCategorize:
    def test_standard_pushback_beats_review_reason(self):
        c = _cand(pushback=True, rr="standards_conflict")
        assert rq._categorize(c) == "standard_pushback"

    def test_review_reason_wins_over_novel(self):
        c = _cand(rr="standards_conflict")
        c.is_novel_combination = True
        assert rq._categorize(c) == "standards_conflict"

    def test_novel_is_default_when_no_reason(self):
        c = _cand()
        c.is_novel_combination = True
        assert rq._categorize(c) == "novel_combination"

    def test_other_catchall(self):
        assert rq._categorize(_cand()) == "other"


class TestOrderCandidates:
    def test_early_phase_promotes_novel_over_conflict(self):
        novel = _cand("novel", std="A")
        novel.is_novel_combination = True
        conflict = _cand("conflict", std="B", rr="standards_conflict")
        out = rq.order_candidates([conflict, novel], phase=rq.PHASE_EARLY)
        # Early: novel_combination (rank 0) before standards_conflict (rank 1).
        assert [c.case_id for c in out] == ["novel", "conflict"]

    def test_late_phase_promotes_conflict_over_novel(self):
        novel = _cand("novel", std="A")
        novel.is_novel_combination = True
        conflict = _cand("conflict", std="B", rr="standards_conflict")
        out = rq.order_candidates([novel, conflict], phase=rq.PHASE_LATE)
        # Late: standards_conflict (rank 0) before novel_combination (rank 2).
        assert [c.case_id for c in out] == ["conflict", "novel"]

    def test_audience_first_groups_general_before_product_ui(self):
        gen_other = _cand("g1", audience="general")
        ui_conflict = _cand("u1", audience=None, rr="standards_conflict")
        out = rq.order_candidates(
            [ui_conflict, gen_other], phase=rq.PHASE_EARLY, audience_first=True,
        )
        # General audience wins outer bucket even though product_ui has
        # a higher-priority subtype inside its bucket.
        assert [c.case_id for c in out] == ["g1", "u1"]

    def test_audience_first_off_lets_subtypes_dominate(self):
        gen_other = _cand("g1", audience="general")
        ui_conflict = _cand("u1", audience=None, rr="standards_conflict")
        out = rq.order_candidates(
            [gen_other, ui_conflict], phase=rq.PHASE_EARLY, audience_first=False,
        )
        # standards_conflict wins subtype race once audience is off.
        assert [c.case_id for c in out] == ["u1", "g1"]

    def test_deterministic(self):
        a = _cand("a", std="CLR-01")
        b = _cand("b", std="CLR-01")
        c = _cand("c", std="CLR-01")
        out1 = rq.order_candidates([c, a, b], phase=rq.PHASE_EARLY)
        out2 = rq.order_candidates([b, c, a], phase=rq.PHASE_EARLY)
        assert [x.case_id for x in out1] == [x.case_id for x in out2]


# ═══════════════════════════════════════════════════════════════════════
# review_queue — batching
# ═══════════════════════════════════════════════════════════════════════


class TestChunkIntoBatches:
    def test_three_per_batch(self):
        cands = [_cand(f"c{i}") for i in range(7)]
        batches = rq.chunk_into_batches(cands, size=3)
        assert [len(b) for b in batches] == [3, 3, 1]

    def test_audience_boundary_closes_batch_early(self):
        g1 = _cand("g1", audience="general")
        g2 = _cand("g2", audience="general")
        u1 = _cand("u1", audience=None)
        u2 = _cand("u2", audience=None)
        batches = rq.chunk_into_batches([g1, g2, u1, u2], size=3)
        # General bucket closes after 2 (not padded); product_ui starts fresh.
        assert [len(b) for b in batches] == [2, 2]

    def test_empty_input(self):
        assert rq.chunk_into_batches([], size=3) == []


# ═══════════════════════════════════════════════════════════════════════
# review_queue — calibration sampling
# ═══════════════════════════════════════════════════════════════════════


class TestCalibrationSample:
    def test_early_phase_takes_5_percent(self):
        pool = [_annotated() for _ in range(100)]
        # Give each a unique case_id so the sample isn't a no-op.
        for i, c in enumerate(pool):
            c["case_id"] = f"c-{i:03d}"
        sample = rq.calibration_sample(pool, queue_size=100, phase=rq.PHASE_EARLY)
        assert len(sample) == 5

    def test_late_phase_takes_10_percent(self):
        pool = [_annotated() for _ in range(100)]
        for i, c in enumerate(pool):
            c["case_id"] = f"c-{i:03d}"
        sample = rq.calibration_sample(pool, queue_size=100, phase=rq.PHASE_LATE)
        assert len(sample) == 10

    def test_only_high_confidence_in_sample(self):
        pool = [_annotated(conf="medium") for _ in range(50)] + \
               [_annotated(conf="high") for _ in range(50)]
        for i, c in enumerate(pool):
            c["case_id"] = f"c-{i:03d}"
        sample = rq.calibration_sample(pool, queue_size=100, phase=rq.PHASE_LATE)
        assert all(c.get("human_confidence") == "high" for c in sample)

    def test_deterministic_with_same_seed(self):
        pool = [_annotated() for _ in range(100)]
        for i, c in enumerate(pool):
            c["case_id"] = f"c-{i:03d}"
        a = rq.calibration_sample(pool, queue_size=100, phase=rq.PHASE_EARLY)
        b = rq.calibration_sample(pool, queue_size=100, phase=rq.PHASE_EARLY)
        assert [c["case_id"] for c in a] == [c["case_id"] for c in b]

    def test_empty_pool_returns_empty(self):
        assert rq.calibration_sample([], queue_size=100, phase=rq.PHASE_EARLY) == []


# ═══════════════════════════════════════════════════════════════════════
# review_queue — end-to-end build_queue
# ═══════════════════════════════════════════════════════════════════════


class TestBuildQueue:
    def test_emits_batches_and_phase(self):
        overrides = [
            {"id": "a", "standard_id": "CLR-01", "content_type": "heading",
             "machine_verdict": "fail", "audience": "general"},
            {"id": "b", "standard_id": "VT-02", "content_type": "button_cta",
             "machine_verdict": "pass", "review_reason": "standards_conflict"},
        ]
        queue = rq.build_queue(overrides, annotated_cases=[])
        assert queue["schema_version"] == "1.0.0"
        assert queue["phase"] == rq.PHASE_EARLY  # empty precedent index
        assert queue["candidates"] == 2
        assert len(queue["batches"]) == 2  # audience-boundary splits

    def test_novel_marker_propagates_to_entry(self):
        overrides = [{"id": "a", "standard_id": "CLR-01",
                      "content_type": "heading", "machine_verdict": "fail"}]
        queue = rq.build_queue(overrides, annotated_cases=[])
        entry = queue["batches"][0]["entries"][0]
        assert entry["is_novel_combination"] is True
        assert entry["category"] == "novel_combination"


# ═══════════════════════════════════════════════════════════════════════
# batch_summary — pattern detection
# ═══════════════════════════════════════════════════════════════════════


class TestSummarizeBatch:
    def test_counts_actions(self):
        entries = [
            {"case_id": "1", "action": "agree"},
            {"case_id": "2", "action": "override", "standard_id": "CLR-01",
             "moment": "error_recovery"},
            {"case_id": "3", "action": "skip"},
        ]
        r = bs.summarize_batch(entries)
        assert r["total"] == 3
        assert r["agree"] == 1
        assert r["override"] == 1
        assert r["skip"] == 1

    def test_flags_recurring_standard_override(self):
        entries = [
            {"case_id": f"c{i}", "action": "override",
             "standard_id": "CLR-01", "moment": "error_recovery",
             "content_type": "error_message"}
            for i in range(3)
        ]
        r = bs.summarize_batch(entries)
        assert len(r["patterns"]) == 1
        p = r["patterns"][0]
        assert p["kind"] == "recurring_standard_override"
        assert p["standard_id"] == "CLR-01"
        assert p["count"] == 3
        assert p["dominant_moment"] == "error_recovery"
        assert p["dominant_content_type"] == "error_message"
        assert p["case_ids"] == ["c0", "c1", "c2"]

    def test_two_overrides_below_threshold_no_pattern(self):
        entries = [
            {"case_id": "c1", "action": "override", "standard_id": "CLR-01"},
            {"case_id": "c2", "action": "override", "standard_id": "CLR-01"},
        ]
        r = bs.summarize_batch(entries)
        assert r["patterns"] == []

    def test_summary_line_mentions_pattern(self):
        entries = [
            {"case_id": f"c{i}", "action": "override",
             "standard_id": "CLR-01", "moment": "error_recovery"}
            for i in range(3)
        ] + [{"case_id": "c-ok", "action": "agree"}]
        r = bs.summarize_batch(entries)
        assert "CLR-01" in r["summary_line"]
        assert "error_recovery" in r["summary_line"]


class TestSuggestNextRefId:
    def test_bumps_highest_in_log(self, tmp_path):
        log = tmp_path / "log.md"
        log.write_text("### REF-001: foo\n\n### REF-003: bar\n")
        assert bs.suggest_next_ref_id(log) == "REF-004"

    def test_missing_log_defaults_to_001(self, tmp_path):
        assert bs.suggest_next_ref_id(tmp_path / "nope.md") == "REF-001"

    def test_empty_log_defaults_to_001(self, tmp_path):
        log = tmp_path / "log.md"
        log.write_text("# Log\n\nNo entries yet.\n")
        assert bs.suggest_next_ref_id(log) == "REF-001"


class TestRenderRefinementCandidate:
    def test_contains_expected_structure(self):
        import datetime as dt
        p = {
            "kind": "recurring_standard_override",
            "standard_id": "CLR-01",
            "count": 4,
            "dominant_moment": "error_recovery",
            "dominant_content_type": "error_message",
            "case_ids": ["c1", "c2", "c3", "c4"],
        }
        text = bs.render_refinement_candidate(
            p, ref_id="REF-042", batch_label="2026_w16",
            today=dt.date(2026, 4, 23),
        )
        assert "### REF-042" in text
        assert "`CLR-01`" in text
        assert "error_recovery" in text
        assert "2026-04-23" in text
        assert "Verdict:** Pending" in text


class TestAppendToLog:
    def test_appends_under_open_refinements(self, tmp_path):
        log = tmp_path / "log.md"
        log.write_text(
            "# Taxonomy refinement log\n\n"
            "## Open refinements\n\n"
            "### REF-001: existing\n\n"
            "**Current category:** x\n\n"
            "## Approved refinements\n\n"
            "(None yet.)\n"
        )
        bs.append_to_log(log, "### REF-002: new\n\n**Current category:** y\n")
        content = log.read_text()
        assert content.index("REF-001") < content.index("REF-002")
        assert content.index("REF-002") < content.index("## Approved refinements")

    def test_raises_when_section_missing(self, tmp_path):
        log = tmp_path / "log.md"
        log.write_text("# Empty log\n")
        with pytest.raises(ValueError):
            bs.append_to_log(log, "### REF-001: x\n")


# ═══════════════════════════════════════════════════════════════════════
# audience_retest
# ═══════════════════════════════════════════════════════════════════════


def _rt_case(**overrides):
    base = {
        "case_id": "x",
        "audience": "product_ui",
        "machine_verdict": "pass",
        "human_verdict": "pass",
        "human_confidence": "high",
    }
    base.update(overrides)
    return base


class TestComputeRetest:
    def test_pending_when_below_trigger(self):
        cases = [_rt_case(audience="general") for _ in range(10)]
        r = ar.compute_retest(cases)
        assert r["trigger_met"] is False
        assert r["decision"] == "pending"

    def test_keep_when_concentration_high(self):
        # 50 general annotated cases. Machine=fail / Human=pass on 30
        # of them → huge FP concentration. Product_ui has no FPs.
        cases = []
        for i in range(30):
            cases.append(_rt_case(
                case_id=f"g-fp-{i}", audience="general",
                machine_verdict="fail", human_verdict="pass",
            ))
        for i in range(20):
            cases.append(_rt_case(case_id=f"g-ok-{i}", audience="general"))
        for i in range(50):
            cases.append(_rt_case(case_id=f"u-{i}", audience="product_ui"))
        r = ar.compute_retest(cases)
        assert r["trigger_met"] is True
        assert r["decision"] == "keep_audience_first"

    def test_drop_when_concentration_low(self):
        # 50 general annotated cases; FPs scattered across audiences.
        cases = []
        for i in range(50):
            cases.append(_rt_case(case_id=f"g-{i}", audience="general"))
        # 10 product_ui FPs; 2 general FPs → P(general | FP) = 2/12 = 17%.
        for i in range(10):
            cases.append(_rt_case(
                case_id=f"u-fp-{i}", audience="product_ui",
                machine_verdict="fail", human_verdict="pass",
            ))
        for i in range(2):
            # Replace two general cases with FPs.
            cases[i] = _rt_case(
                case_id=cases[i]["case_id"], audience="general",
                machine_verdict="fail", human_verdict="pass",
            )
        r = ar.compute_retest(cases)
        assert r["trigger_met"] is True
        assert r["decision"] == "drop_audience_first"

    def test_inconclusive_when_no_false_positives(self):
        # Trigger met, but no FPs at all → concentration undefined.
        cases = [_rt_case(case_id=f"g-{i}", audience="general") for i in range(50)]
        r = ar.compute_retest(cases)
        assert r["trigger_met"] is True
        assert r["decision"] == "inconclusive"
