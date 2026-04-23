"""Tests for the rationale-chain instrumentation (human-eval build plan Session 1).

Covers the pure helpers in pipeline.py that attach per-standard versions
to emitted Violations. The full chain end-to-end is exercised through
real LLM calls, which these tests deliberately avoid — the integration
side lives under tests/test_integration_seams.py.
"""

from __future__ import annotations

from content_checker.models import Violation
from content_checker.pipeline import (
    _build_rule_version_map,
    _stamp_rule_versions,
)
from content_checker.standards.loader import load_standards


class TestBuildRuleVersionMap:
    def test_maps_standard_id_to_version(self):
        data = load_standards()
        versions = _build_rule_version_map(data)
        # Every standard in the loaded library should have a version.
        total = sum(len(cat["standards"]) for cat in data["categories"])
        assert len(versions) == total

    def test_every_entry_is_semver_shape(self):
        data = load_standards()
        versions = _build_rule_version_map(data)
        for sid, ver in versions.items():
            parts = ver.split(".")
            assert len(parts) == 3, f"{sid} version {ver} not semver"

    def test_ignores_entries_missing_version(self):
        fake = {
            "categories": [
                {
                    "standards": [
                        {"id": "A", "version": "1.0.0"},
                        {"id": "B"},
                        {"version": "9.9.9"},
                    ]
                }
            ]
        }
        versions = _build_rule_version_map(fake)
        assert versions == {"A": "1.0.0"}

    def test_empty_data_returns_empty_dict(self):
        assert _build_rule_version_map({}) == {}
        assert _build_rule_version_map({"categories": []}) == {}


class TestStampRuleVersions:
    def test_populates_rule_version_from_map(self):
        violations = [
            Violation("CLR-01", "r", "i", "s"),
            Violation("GRM-04", "r", "i", "s"),
        ]
        _stamp_rule_versions(violations, {"CLR-01": "4.6.1", "GRM-04": "4.6.1"})
        assert violations[0].rule_version == "4.6.1"
        assert violations[1].rule_version == "4.6.1"

    def test_unknown_standard_stays_none(self):
        v = Violation("WAT-99", "r", "i", "s")
        _stamp_rule_versions([v], {"CLR-01": "4.6.1"})
        assert v.rule_version is None

    def test_does_not_overwrite_existing_rule_version(self):
        v = Violation(
            "CLR-01", "r", "i", "s", rule_version="4.5.0",
        )
        _stamp_rule_versions([v], {"CLR-01": "4.6.1"})
        # Existing rule_version is preserved — reproducibility matters
        # more than a fresh-from-library stamp.
        assert v.rule_version == "4.5.0"

    def test_empty_list_is_noop(self):
        _stamp_rule_versions([], {"CLR-01": "4.6.1"})  # does not raise
