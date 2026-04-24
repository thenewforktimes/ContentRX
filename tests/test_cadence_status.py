"""Tests for `tools/cadence_status.py`.

Human-eval build plan Session 33. Pure-logic coverage — the disk
sniffing functions read the filesystem only via `_source_for`,
which we monkey-patch in the relevant cases.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import cadence_status as cs  # noqa: E402


NOW = datetime(2026, 4, 24, 12, 0, tzinfo=timezone.utc)


def _run_with_fake_source(monkeypatch, kind_to_last):
    def fake_source(kind: str):
        last = kind_to_last.get(kind)
        return (last, "(fake)" if last else "none")
    monkeypatch.setattr(cs, "_source_for", fake_source)


def test_collect_snapshots_returns_one_per_cadence(monkeypatch):
    _run_with_fake_source(monkeypatch, {})
    snaps = cs.collect_snapshots(now=NOW)
    kinds = sorted(s.kind for s in snaps)
    assert kinds == ["annual", "monthly", "quarterly", "weekly"]


def test_eligible_when_never_run(monkeypatch):
    _run_with_fake_source(monkeypatch, {})
    snaps = cs.collect_snapshots(now=NOW)
    for s in snaps:
        assert s.status == "eligible"
        assert s.last_completed_at is None
        assert s.days_overdue == 0


def test_on_track_inside_interval(monkeypatch):
    last = NOW - timedelta(days=2)
    _run_with_fake_source(monkeypatch, {"weekly": last})
    snaps = cs.collect_snapshots(now=NOW)
    weekly = next(s for s in snaps if s.kind == "weekly")
    assert weekly.status == "on_track"
    assert weekly.next_due_at is not None


def test_overdue_past_grace_window(monkeypatch):
    # Quarterly: 91d interval + 21d grace → 115d ago is overdue.
    last = NOW - timedelta(days=115)
    _run_with_fake_source(monkeypatch, {"quarterly": last})
    snaps = cs.collect_snapshots(now=NOW)
    quarterly = next(s for s in snaps if s.kind == "quarterly")
    assert quarterly.status == "overdue"
    assert quarterly.days_overdue > 0
    assert quarterly.load_bearing is True


def test_status_for_eligible_inside_grace():
    spec = {"interval_days": 7, "grace_days": 3}
    last = NOW - timedelta(days=8)
    out = cs._status_for(spec, last, NOW)
    assert out["status"] == "eligible"
    assert out["days_overdue"] == 1


def test_status_for_overdue_past_grace():
    spec = {"interval_days": 7, "grace_days": 3}
    last = NOW - timedelta(days=12)
    out = cs._status_for(spec, last, NOW)
    assert out["status"] == "overdue"
    assert out["days_overdue"] == 5


def test_max_dt_picks_the_later_value():
    a = datetime(2025, 1, 1, tzinfo=timezone.utc)
    b = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert cs._max_dt(a, b) == b
    assert cs._max_dt(b, a) == b
    assert cs._max_dt(None, a) == a
    assert cs._max_dt(a, None) == a
    assert cs._max_dt(None, None) is None


def test_human_output_marks_overdue_cadences(monkeypatch):
    last = NOW - timedelta(days=120)
    _run_with_fake_source(monkeypatch, {"quarterly": last})
    snaps = cs.collect_snapshots(now=NOW)
    out = cs._format_human(snaps)
    assert "QUARTERLY" in out
    assert "OVERDUE" in out
    assert "load-bearing" in out


def test_cadence_specs_cover_expected_intervals():
    kinds = {c["kind"]: c for c in cs.CADENCES}
    assert kinds["weekly"]["interval_days"] == 7
    assert kinds["monthly"]["interval_days"] == 28
    assert kinds["quarterly"]["interval_days"] == 91
    assert kinds["annual"]["interval_days"] == 365
    assert kinds["quarterly"]["load_bearing"] is True
