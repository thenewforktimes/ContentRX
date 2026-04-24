"""Tests for the `docs_url` field populated on every Violation.

BUILD_PLAN_v2 Appendix A non-negotiable: every violation emitted
includes a `docs_url` pointing at the rationale on docs.contentrx.io.
Schema v1.7.0.
"""

from __future__ import annotations

import pytest

from content_checker.models import (
    DEFAULT_DOCS_BASE_URL,
    SCHEMA_VERSION,
    Violation,
    standard_docs_url,
)


def test_standard_docs_url_uses_default_base():
    assert (
        standard_docs_url("ACT-01")
        == f"{DEFAULT_DOCS_BASE_URL}/model/standards/ACT-01"
    )


def test_standard_docs_url_honors_env_override(monkeypatch):
    monkeypatch.setenv("CONTENTRX_DOCS_URL", "https://docs.staging.contentrx.io/")
    assert (
        standard_docs_url("ACT-01")
        == "https://docs.staging.contentrx.io/model/standards/ACT-01"
    )


def test_standard_docs_url_blank_env_falls_back(monkeypatch):
    monkeypatch.setenv("CONTENTRX_DOCS_URL", "   ")
    assert (
        standard_docs_url("ACT-01")
        == f"{DEFAULT_DOCS_BASE_URL}/model/standards/ACT-01"
    )


def test_violation_to_dict_includes_docs_url():
    v = Violation(
        standard_id="ACT-01",
        rule="Use a specific verb.",
        issue="Generic CTA",
        suggestion="Try a specific verb.",
    )
    d = v.to_dict()
    assert d["docs_url"] == f"{DEFAULT_DOCS_BASE_URL}/model/standards/ACT-01"


def test_violation_to_dict_docs_url_tracks_standard_id():
    v = Violation(
        standard_id="TN-03",
        rule="Specific rule.",
        issue="issue",
        suggestion="fix",
    )
    d = v.to_dict()
    assert d["docs_url"].endswith("/TN-03")


def test_schema_version_bumped_for_docs_url():
    # Appendix A non-negotiable shipped at 1.7.0. If the envelope
    # changes shape again, the version must bump in lock-step per the
    # module comment. Pin the version so accidental drift trips the
    # test.
    assert SCHEMA_VERSION == "1.7.0"
