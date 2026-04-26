"""Tests for the quarterly report scaffold generator."""

from __future__ import annotations

import importlib.util
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parent.parent
_GENERATOR_PATH = _REPO_ROOT / "reports" / "quarterly" / "generate.py"

_spec = importlib.util.spec_from_file_location(
    "_quarterly_generator", _GENERATOR_PATH
)
assert _spec and _spec.loader
quarterly_generator = importlib.util.module_from_spec(_spec)
sys.modules["_quarterly_generator"] = quarterly_generator
_spec.loader.exec_module(quarterly_generator)


FIXED_NOW = datetime(2026, 6, 30, 14, 0, 0, tzinfo=timezone.utc)


def _measured_accuracy() -> dict:
    return {
        "schema_version": "1.0.0",
        "generated_at": "2026-06-30T03:00:00Z",
        "measured_system": {
            "state": "measured",
            "value": 0.881,
            "ci_low": 0.860,
            "ci_high": 0.902,
            "sample_size": 1500,
        },
        "measured_self_drift": {
            "state": "measured",
            "value": 0.910,
            "ci_low": 0.886,
            "ci_high": 0.934,
            "sample_size": 200,
        },
        "design_target": 0.9,
        "by_level": {"robo_labels": 38, "batch_approval": 6, "autonomous": 3},
        "standards_measured": 9,
        "standards_total": 47,
    }


def _weeks_with_trajectory() -> list:
    Snap = quarterly_generator.CalibrationWeekSnapshot
    return [
        Snap(week="2026-15", kappa=0.840, sample_size=900, active_refinements=2),
        Snap(week="2026-16", kappa=0.855, sample_size=1100, active_refinements=2),
        Snap(week="2026-17", kappa=0.872, sample_size=1300, active_refinements=1),
        Snap(week="2026-18", kappa=0.881, sample_size=1500, active_refinements=1),
    ]


class TestCurrentQuarter:
    @pytest.mark.parametrize(
        "month,expected",
        [
            (1, "Q1"),
            (3, "Q1"),
            (4, "Q2"),
            (6, "Q2"),
            (7, "Q3"),
            (9, "Q3"),
            (10, "Q4"),
            (12, "Q4"),
        ],
    )
    def test_quarter_for_month(self, month, expected):
        out = quarterly_generator.current_quarter(date(2026, month, 15))
        assert out == f"2026-{expected}"


class TestBuilder:
    def test_pending_when_no_inputs(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=None,
            calibration_weeks=[],
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        assert report.measured_system is None
        assert report.measured_self_drift is None
        assert report.kappa_delta_pp is None
        assert report.weeks_in_quarter == []

    def test_kappa_delta_uses_first_week_with_kappa(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        assert report.kappa_at_quarter_start == pytest.approx(0.840)
        # Current 0.881 - start 0.840 = 4.1pp
        assert report.kappa_delta_pp == pytest.approx(4.1, abs=0.05)

    def test_by_level_passthrough(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=[],
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        assert report.by_level == {
            "robo_labels": 38,
            "batch_approval": 6,
            "autonomous": 3,
        }


class TestRendering:
    def test_renders_h1_with_quarter(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        md = quarterly_generator.render_markdown(report)
        assert md.startswith("# Quarterly accuracy report — 2026-Q2")

    def test_renders_kappa_with_ci(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        md = quarterly_generator.render_markdown(report)
        assert "0.881" in md
        assert "[0.860, 0.902]" in md

    def test_renders_quarter_to_date_delta(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        md = quarterly_generator.render_markdown(report)
        assert "+4.1 percentage points" in md
        assert "0.840" in md

    def test_includes_trajectory_table(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        md = quarterly_generator.render_markdown(report)
        assert "| Week | κ | n | Active refinements |" in md
        assert "| 2026-15 | 0.840 | 900 | 2 |" in md
        assert "| 2026-18 | 0.881 | 1500 | 1 |" in md

    def test_renders_pending_drift_honestly(self):
        accuracy = _measured_accuracy()
        accuracy["measured_self_drift"] = {
            "state": "pending_measurement",
            "reason": "panel awaiting blind re-label",
        }
        report = quarterly_generator.build_quarterly_report(
            accuracy=accuracy,
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        md = quarterly_generator.render_markdown(report)
        assert "pending" in md.lower()
        assert "0.000" not in md  # never coerce to 0

    def test_includes_founder_narrative_todos(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        md = quarterly_generator.render_markdown(report)
        assert "## Executive summary" in md
        assert "## What we got wrong" in md
        assert "## What's next" in md
        assert "TODO" in md

    def test_does_not_leak_substrate_field_names(self):
        report = quarterly_generator.build_quarterly_report(
            accuracy=_measured_accuracy(),
            calibration_weeks=_weeks_with_trajectory(),
            quarter="2026-Q2",
            now=FIXED_NOW,
        )
        md = quarterly_generator.render_markdown(report)
        for forbidden in (
            "CLR-01",
            "GRM-06",
            "rationale_chain",
            "rule_version",
            "destructive_action",
        ):
            assert forbidden not in md, f"{forbidden!r} leaked"


class TestParseCalibrationWeek:
    def test_extracts_kappa_from_calibration_markdown(self):
        md = """# Calibration log — 2026-17

## Measured system κ

- κ = **0.872** (95% CI [0.851, 0.893], n = 1234).
- Week-over-week delta: +1.2 percentage points.

## Drift

- Self-drift κ = 0.910.

## Coverage
...

## Active refinements

- Open: **2**.
  - REF-001: foo
  - REF-002: bar
"""
        snap = quarterly_generator._parse_calibration_week(
            week="2026-17", md=md
        )
        assert snap.week == "2026-17"
        assert snap.kappa == pytest.approx(0.872)
        assert snap.sample_size == 1234
        assert snap.active_refinements == 2

    def test_handles_pending_kappa_calibration_markdown(self):
        md = """# Calibration log — 2026-17

## Measured system κ

- _Pending — no accuracy snapshot available this week._

## Active refinements

- Open: **0**.
"""
        snap = quarterly_generator._parse_calibration_week(
            week="2026-17", md=md
        )
        assert snap.kappa is None
        assert snap.sample_size is None
        assert snap.active_refinements == 0


class TestWeekToQuarter:
    def test_q2_includes_april_weeks(self):
        # ISO week 15 of 2026 starts Monday 2026-04-06 (April → Q2).
        assert quarterly_generator._week_belongs_to_quarter(
            2026, 15, "2026-Q2"
        )

    def test_q2_excludes_march_weeks(self):
        # ISO week 13 of 2026 starts Monday 2026-03-23 (March → Q1).
        assert not quarterly_generator._week_belongs_to_quarter(
            2026, 13, "2026-Q2"
        )

    def test_different_year_excluded(self):
        assert not quarterly_generator._week_belongs_to_quarter(
            2025, 18, "2026-Q2"
        )
