"""Tests for the shared LLM JSON response parser."""

from __future__ import annotations

from content_checker.llm_json import parse_llm_json, strip_code_fence


class TestStripCodeFence:
    def test_no_fence_returns_trimmed(self):
        assert strip_code_fence('  {"a": 1}  ') == '{"a": 1}'

    def test_strips_json_fence(self):
        raw = '```json\n{"a": 1}\n```'
        assert strip_code_fence(raw) == '{"a": 1}'

    def test_strips_bare_fence(self):
        raw = '```\n{"a": 1}\n```'
        assert strip_code_fence(raw) == '{"a": 1}'

    def test_handles_fence_without_newline(self):
        raw = '```{"a": 1}```'
        assert strip_code_fence(raw) == '{"a": 1}'

    def test_handles_trailing_whitespace_after_fence(self):
        raw = '```json\n{"a": 1}\n```\n\n'
        assert strip_code_fence(raw) == '{"a": 1}'


class TestParseLlmJson:
    def test_parses_plain_json(self):
        assert parse_llm_json('{"verdict": "pass"}') == {"verdict": "pass"}

    def test_parses_fenced_json(self):
        assert parse_llm_json('```json\n{"verdict": "pass"}\n```') == {
            "verdict": "pass"
        }

    def test_returns_none_on_malformed(self):
        assert parse_llm_json('{"verdict": "pa') is None

    def test_returns_none_on_empty(self):
        assert parse_llm_json("") is None

    def test_returns_none_on_non_json(self):
        assert parse_llm_json("Sure, here is the result") is None
