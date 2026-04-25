"""Tests for data models."""

from content_checker.models import (
    AMBIGUITY_STANDARDS_CONFLICT,
    CheckResult,
    HOP_CLASSIFY,
    HOP_MERGE,
    HOP_PREPROCESS,
    PassedStandard,
    PipelineMeta,
    RationaleHop,
    TokenUsage,
    VALID_AMBIGUITY_FLAGS,
    VALID_HOPS,
    Violation,
)


class TestViolation:
    def test_defaults(self):
        v = Violation(standard_id="GRM-01", rule="test", issue="test", suggestion="fix")
        assert v.source == "llm"

    def test_to_dict(self):
        v = Violation(
            standard_id="GRM-01", rule="r", issue="i", suggestion="s", source="deterministic"
        )
        d = v.to_dict()
        assert d["standard_id"] == "GRM-01"
        assert d["source"] == "deterministic"

    def test_v120_fields_default_empty(self):
        v = Violation(standard_id="CLR-01", rule="r", issue="i", suggestion="s")
        d = v.to_dict()
        assert d["related_standards"] == []
        assert d["ambiguity_flag"] is None
        assert d["rule_version"] is None

    def test_v120_fields_populated(self):
        v = Violation(
            standard_id="CLR-01", rule="r", issue="i", suggestion="s",
            related_standards=["PRF-11", "VT-02"],
            ambiguity_flag=AMBIGUITY_STANDARDS_CONFLICT,
            rule_version="4.6.1",
        )
        d = v.to_dict()
        assert d["related_standards"] == ["PRF-11", "VT-02"]
        assert d["ambiguity_flag"] == "standards_conflict"
        assert d["rule_version"] == "4.6.1"

    def test_v160_validate_rejection_reason_defaults_none(self):
        # Session 13: validate_rejection_reason defaults to None
        # (preprocessor violations + confirmed LLM violations both
        # land here without a rejection reason).
        v = Violation(standard_id="CLR-01", rule="r", issue="i", suggestion="s")
        assert v.to_dict()["validate_rejection_reason"] is None

    def test_v160_validate_rejection_reason_populated(self):
        v = Violation(
            standard_id="CLR-01", rule="r", issue="i", suggestion="s",
            validate_rejection_reason="content_type_notes say this is acceptable for error_message",
        )
        d = v.to_dict()
        assert d["validate_rejection_reason"].startswith("content_type_notes")

    def test_related_standards_default_not_shared(self):
        """default_factory must produce an independent list per instance."""
        a = Violation(standard_id="A", rule="", issue="", suggestion="")
        b = Violation(standard_id="B", rule="", issue="", suggestion="")
        a.related_standards.append("PRF-11")
        assert b.related_standards == []

    def test_all_ambiguity_flag_constants_in_frozenset(self):
        """Each named constant must be in VALID_AMBIGUITY_FLAGS."""
        assert AMBIGUITY_STANDARDS_CONFLICT in VALID_AMBIGUITY_FLAGS
        # The frozenset should have exactly four members.
        assert len(VALID_AMBIGUITY_FLAGS) == 4


class TestRationaleHop:
    def test_minimal_hop(self):
        hop = RationaleHop(step=HOP_CLASSIFY)
        d = hop.to_dict()
        assert d["step"] == "classify"
        assert d["inputs"] == {}
        assert d["output"] == {}
        assert d["confidence"] is None
        assert d["rule_versions"] == {}
        assert d["ambiguity_flag"] is None

    def test_populated_hop(self):
        hop = RationaleHop(
            step=HOP_PREPROCESS,
            inputs={"text_len": 42, "content_type": "error_message"},
            output={"violations_count": 1, "standards_fired": ["GRM-04"]},
            confidence=1.0,
            rule_versions={"GRM-04": "4.6.1"},
        )
        d = hop.to_dict()
        assert d["step"] == "preprocess"
        assert d["confidence"] == 1.0
        assert d["rule_versions"] == {"GRM-04": "4.6.1"}

    def test_valid_hops_covers_canonical_steps(self):
        assert VALID_HOPS == {
            "classify", "detect_moment", "filter",
            "preprocess", "scan", "validate", "merge",
        }

    def test_dict_fields_are_independent_per_instance(self):
        """default_factory for inputs/output/rule_versions must not share."""
        a = RationaleHop(step=HOP_CLASSIFY)
        b = RationaleHop(step=HOP_CLASSIFY)
        a.inputs["k"] = "v"
        a.output["x"] = 1
        a.rule_versions["CLR-01"] = "4.6.1"
        assert b.inputs == {}
        assert b.output == {}
        assert b.rule_versions == {}


class TestTokenUsage:
    def test_iadd(self):
        a = TokenUsage(input=100, output=50)
        b = TokenUsage(input=200, output=100)
        a += b
        assert a.input == 300
        assert a.output == 150

    def test_iadd_with_cache_fields(self):
        # Cache fields (audit M-24, PR 9) accumulate via __iadd__.
        a = TokenUsage(input=100, output=50, cache_creation_input=10, cache_read_input=20)
        b = TokenUsage(input=200, output=100, cache_creation_input=5, cache_read_input=200)
        a += b
        assert a.input == 300
        assert a.output == 150
        assert a.cache_creation_input == 15
        assert a.cache_read_input == 220

    def test_to_dict(self):
        # to_dict reports all 4 fields after PR 9. cache_* default to 0.
        t = TokenUsage(input=10, output=5)
        assert t.to_dict() == {
            "input": 10,
            "output": 5,
            "cache_creation_input": 0,
            "cache_read_input": 0,
        }

    def test_to_dict_with_cache_fields(self):
        t = TokenUsage(input=10, output=5, cache_creation_input=100, cache_read_input=900)
        assert t.to_dict() == {
            "input": 10,
            "output": 5,
            "cache_creation_input": 100,
            "cache_read_input": 900,
        }


class TestCheckResult:
    def test_to_dict_roundtrip(self):
        result = CheckResult(
            content_type="button_cta",
            overall_verdict="fail",
            violations=[Violation("GRM-04", "rule", "issue", "fix", "deterministic")],
            passes=[PassedStandard("ACT-01", "verb rule")],
            summary="Found an ampersand.",
            pipeline=PipelineMeta(standards_checked=6, standards_total=46),
        )
        d = result.to_dict()
        assert d["content_type"] == "button_cta"
        assert d["overall_verdict"] == "fail"
        assert len(d["violations"]) == 1
        assert d["violations"][0]["standard_id"] == "GRM-04"
        assert d["pipeline"]["standards_checked"] == 6

    def test_rationale_chain_default_empty(self):
        result = CheckResult(content_type="x", overall_verdict="pass")
        d = result.to_dict()
        assert d["rationale_chain"] == []

    def test_rationale_chain_roundtrip(self):
        hops = [
            RationaleHop(step=HOP_CLASSIFY, output={"detected_type": "button_cta"}),
            RationaleHop(
                step=HOP_MERGE,
                output={"final_violations": 0, "final_passes": 3},
            ),
        ]
        result = CheckResult(
            content_type="button_cta",
            overall_verdict="pass",
            rationale_chain=hops,
        )
        d = result.to_dict()
        assert len(d["rationale_chain"]) == 2
        assert d["rationale_chain"][0]["step"] == "classify"
        assert d["rationale_chain"][1]["step"] == "merge"
