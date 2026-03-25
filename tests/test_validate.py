"""Tests for the validation pass (structural only — no API calls)."""

from content_checker.models import TokenUsage
from content_checker.validate import _build_validation_prompt, validate_candidates


class TestPromptBuilding:
    def test_includes_content_type(self):
        prompt = _build_validation_prompt("confirmation", [])
        assert "confirmation" in prompt

    def test_includes_notes(self):
        notes = [{"standard_id": "VT-01", "note": "Passive voice is acceptable."}]
        prompt = _build_validation_prompt("confirmation", notes)
        assert "Passive voice is acceptable" in prompt
        assert "VT-01" in prompt

    def test_includes_confirm_reject(self):
        prompt = _build_validation_prompt("button_cta", [])
        assert "confirm" in prompt
        assert "reject" in prompt

    def test_no_notes_section_when_empty(self):
        prompt = _build_validation_prompt("button_cta", [])
        assert "Content type notes" not in prompt


class TestEmptyCandidates:
    def test_returns_empty(self):
        confirmed, rejected, latency, tokens = validate_candidates(
            "test", "button_cta", [],
        )
        assert confirmed == []
        assert rejected == []
        assert latency == 0.0
        assert isinstance(tokens, TokenUsage)
        assert tokens.input == 0
