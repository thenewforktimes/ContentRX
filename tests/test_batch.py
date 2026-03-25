"""Tests for the batch handler (structural — no API calls)."""

import json

import pytest

from content_checker.batch import _build_consistency_prompt, _check_consistency
from content_checker.models import (
    BatchResult,
    CheckResult,
    ConsistencyViolation,
    ContentItem,
    ItemResult,
    TokenUsage,
)


class TestContentItem:
    def test_minimal(self):
        item = ContentItem(text="Save changes")
        assert item.text == "Save changes"
        assert item.label == ""
        assert item.file_path == ""
        assert item.line_number == 0
        assert item.content_type == ""

    def test_full_metadata(self):
        item = ContentItem(
            text="Click here",
            label="CTA button",
            file_path="src/Login.jsx",
            line_number=42,
            content_type="button_cta",
        )
        assert item.label == "CTA button"
        assert item.file_path == "src/Login.jsx"
        assert item.line_number == 42

    def test_to_dict_minimal(self):
        d = ContentItem(text="Hello").to_dict()
        assert d == {"text": "Hello"}
        assert "label" not in d  # omitted when empty

    def test_to_dict_full(self):
        d = ContentItem(
            text="Hello", label="Greeting", file_path="a.jsx", line_number=1, content_type="ui_label"
        ).to_dict()
        assert d["label"] == "Greeting"
        assert d["file_path"] == "a.jsx"
        assert d["line_number"] == 1
        assert d["content_type"] == "ui_label"


class TestItemResult:
    def test_to_dict(self):
        ir = ItemResult(
            item=ContentItem(text="Test"),
            result=CheckResult(content_type="ui_label", overall_verdict="pass"),
            latency=1.5,
            tokens=TokenUsage(input=100, output=50),
        )
        d = ir.to_dict()
        assert d["item"]["text"] == "Test"
        assert d["result"]["overall_verdict"] == "pass"
        assert d["latency"] == 1.5
        assert d["tokens"]["input"] == 100


class TestConsistencyViolation:
    def test_to_dict(self):
        cv = ConsistencyViolation(
            standard_id="CON-01",
            rule="Use consistent terminology.",
            issue="'Settings' and 'Preferences' refer to the same thing.",
            suggestion="Use 'Settings' consistently.",
            items_involved=["Go to Settings", "Open the Preferences panel"],
        )
        d = cv.to_dict()
        assert d["standard_id"] == "CON-01"
        assert len(d["items_involved"]) == 2


class TestBatchResult:
    def test_empty_batch(self):
        br = BatchResult()
        assert br.total_items == 0
        assert br.items_passed == 0
        assert br.items_failed == 0
        assert br.overall_verdict == "pass"

    def test_counts(self):
        br = BatchResult(
            item_results=[
                ItemResult(
                    item=ContentItem(text="A"),
                    result=CheckResult(content_type="ui_label", overall_verdict="pass"),
                ),
                ItemResult(
                    item=ContentItem(text="B"),
                    result=CheckResult(content_type="ui_label", overall_verdict="fail"),
                ),
                ItemResult(
                    item=ContentItem(text="C"),
                    result=CheckResult(content_type="ui_label", overall_verdict="pass"),
                ),
            ],
            overall_verdict="fail",
        )
        assert br.total_items == 3
        assert br.items_passed == 2
        assert br.items_failed == 1

    def test_to_dict(self):
        br = BatchResult(
            item_results=[
                ItemResult(
                    item=ContentItem(text="A"),
                    result=CheckResult(content_type="ui_label", overall_verdict="pass"),
                ),
            ],
            consistency_violations=[
                ConsistencyViolation(
                    standard_id="CON-01",
                    rule="test",
                    issue="inconsistency",
                    suggestion="fix",
                    items_involved=["A", "B"],
                )
            ],
            overall_verdict="fail",
            total_latency=5.0,
            total_tokens=TokenUsage(input=500, output=200),
        )
        d = br.to_dict()
        assert d["overall_verdict"] == "fail"
        assert d["total_items"] == 1
        assert d["items_passed"] == 1
        assert d["items_failed"] == 0
        assert len(d["consistency_violations"]) == 1
        assert d["total_latency"] == 5.0


class TestConsistencyPrompt:
    def test_includes_standards(self, standards_data):
        multi_standards = []
        for cat in standards_data["categories"]:
            for std in cat["standards"]:
                if std.get("requires_multi_snippet"):
                    multi_standards.append(std)

        prompt = _build_consistency_prompt(multi_standards)
        assert "CON-01" in prompt
        assert "CON-04" in prompt
        assert "TRN-07" in prompt
        assert "consistency" in prompt.lower()

    def test_empty_standards(self):
        prompt = _build_consistency_prompt([])
        assert "consistency" in prompt.lower()


class TestConsistencyCheckSkips:
    def test_single_item_skips(self):
        """Consistency check needs 2+ items."""
        violations, latency, tokens = _check_consistency(
            [ContentItem(text="Just one string")],
        )
        assert violations == []
        assert latency == 0.0
        assert tokens.input == 0

    def test_empty_items_skips(self):
        violations, latency, tokens = _check_consistency([])
        assert violations == []
        assert latency == 0.0


class TestBatchFileLoading:
    def test_load_txt(self, tmp_path):
        from cli.main import _load_batch_file

        f = tmp_path / "strings.txt"
        f.write_text("Save changes\nYour account is ready.\n\nDelete file\n")
        items = _load_batch_file(str(f))
        assert len(items) == 3
        assert items[0].text == "Save changes"
        assert items[2].text == "Delete file"

    def test_load_json_strings(self, tmp_path):
        from cli.main import _load_batch_file

        f = tmp_path / "strings.json"
        f.write_text(json.dumps(["Save changes", "Delete file"]))
        items = _load_batch_file(str(f))
        assert len(items) == 2
        assert items[0].text == "Save changes"

    def test_load_json_objects(self, tmp_path):
        from cli.main import _load_batch_file

        f = tmp_path / "strings.json"
        f.write_text(json.dumps([
            {"text": "Save changes", "label": "CTA", "content_type": "button_cta"},
            {"text": "Your settings", "label": "Nav"},
        ]))
        items = _load_batch_file(str(f))
        assert len(items) == 2
        assert items[0].label == "CTA"
        assert items[0].content_type == "button_cta"
        assert items[1].label == "Nav"
        assert items[1].content_type == ""
