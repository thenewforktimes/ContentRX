"""Tests for data models."""

from content_checker.models import (
    CheckResult,
    PassedStandard,
    PipelineMeta,
    TokenUsage,
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


class TestTokenUsage:
    def test_iadd(self):
        a = TokenUsage(input=100, output=50)
        b = TokenUsage(input=200, output=100)
        a += b
        assert a.input == 300
        assert a.output == 150

    def test_to_dict(self):
        t = TokenUsage(input=10, output=5)
        assert t.to_dict() == {"input": 10, "output": 5}


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
