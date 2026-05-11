"""Tests for the reports staleness watchdog (Phase C4).

The script in `scripts/check_reports_staleness.py` runs as a daily
GitHub Actions cron and exits non-zero when any report subdirectory's
newest file is older than its per-type threshold. Tests exercise the
script end-to-end against tmp_path fixtures by overriding the script's
module-level constants for the duration of each test.

Modification time source: the script reads "last touched" via
`_last_modified()`, which prefers git committer time and falls back
to filesystem mtime when git can't answer. In tests the tmp files
aren't in git, so we monkeypatch `_last_modified` to read mtime
directly (via `os.utime` set per test) — without that monkeypatch
the script would warn-and-fall-through to mtime anyway, which works
but emits noisy stderr.
"""

from __future__ import annotations

import importlib.util
import os
import sys
import time
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parent.parent
_SCRIPT_PATH = _REPO_ROOT / "scripts" / "check_reports_staleness.py"

_spec = importlib.util.spec_from_file_location(
    "_staleness_script", _SCRIPT_PATH
)
assert _spec and _spec.loader
staleness = importlib.util.module_from_spec(_spec)
sys.modules["_staleness_script"] = staleness
_spec.loader.exec_module(staleness)


@pytest.fixture
def staged_reports(tmp_path, monkeypatch):
    """Build a tmp `reports/` tree and point the script at it.

    Also rebind `_last_modified` to read fs mtime — tmp files aren't
    in git, so the production git-first lookup would always fall back
    anyway. Doing the fallback explicitly keeps stderr clean for the
    "all subdirs fresh" tests.
    """
    root = tmp_path / "reports"
    for sub in ("accuracy", "calibration", "quarterly"):
        (root / sub).mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(staleness, "REPORTS_ROOT", root)
    monkeypatch.setattr(
        staleness, "_last_modified", lambda p: p.stat().st_mtime
    )
    return root


def _touch(path: Path, age_seconds: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("placeholder", encoding="utf-8")
    target = time.time() - age_seconds
    os.utime(path, (target, target))


class TestStaleness:
    def test_passes_when_all_subdirs_fresh(self, staged_reports):
        _touch(staged_reports / "accuracy" / "latest.json", age_seconds=600)
        _touch(staged_reports / "calibration" / "2026-17.md", age_seconds=86_400)
        _touch(staged_reports / "quarterly" / "2026-Q2.md", age_seconds=10 * 86_400)
        assert staleness.main() == 0

    def test_fails_when_accuracy_is_stale(self, staged_reports):
        # Threshold is 2 days; 4 days old → stale.
        _touch(
            staged_reports / "accuracy" / "latest.json",
            age_seconds=4 * 86_400,
        )
        _touch(staged_reports / "calibration" / "2026-17.md", age_seconds=86_400)
        _touch(staged_reports / "quarterly" / "2026-Q2.md", age_seconds=86_400)
        assert staleness.main() == 1

    def test_fails_when_calibration_is_stale(self, staged_reports):
        # Threshold is 8 days; 10 days old → stale.
        _touch(staged_reports / "accuracy" / "latest.json", age_seconds=600)
        _touch(
            staged_reports / "calibration" / "2026-17.md",
            age_seconds=10 * 86_400,
        )
        _touch(staged_reports / "quarterly" / "2026-Q2.md", age_seconds=86_400)
        assert staleness.main() == 1

    def test_fails_when_subdir_empty(self, staged_reports):
        _touch(staged_reports / "accuracy" / "latest.json", age_seconds=600)
        # calibration has no files — should fail.
        _touch(staged_reports / "quarterly" / "2026-Q2.md", age_seconds=86_400)
        assert staleness.main() == 1

    def test_ignores_dotfiles(self, staged_reports):
        # .gitkeep alone shouldn't satisfy the freshness check.
        (staged_reports / "accuracy" / ".gitkeep").touch()
        _touch(staged_reports / "calibration" / "2026-17.md", age_seconds=86_400)
        _touch(staged_reports / "quarterly" / "2026-Q2.md", age_seconds=86_400)
        assert staleness.main() == 1

    def test_returns_2_when_reports_root_missing(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            staleness, "REPORTS_ROOT", tmp_path / "does-not-exist"
        )
        assert staleness.main() == 2

    def test_quarterly_threshold_lenient(self, staged_reports):
        # Quarterly threshold is 95 days; 60 days old should still pass.
        _touch(staged_reports / "accuracy" / "latest.json", age_seconds=600)
        _touch(staged_reports / "calibration" / "2026-17.md", age_seconds=86_400)
        _touch(
            staged_reports / "quarterly" / "2025-Q4.md",
            age_seconds=60 * 86_400,
        )
        assert staleness.main() == 0


class TestLastModifiedFromGit:
    """Regression guard for the 2026-05-11 audit. Under `actions/checkout`
    every file's filesystem mtime is the checkout time, so the watchdog
    used to report every file as ~minutes old and the 2/8/95-day
    thresholds were unreachable. `_last_modified` now reads git committer
    time first.
    """

    def test_git_committer_time_used_when_available(self, tmp_path, monkeypatch):
        # Stub out subprocess.run to simulate a successful git log call.
        target_ts = time.time() - 30 * 86_400  # 30 days ago

        class FakeResult:
            returncode = 0
            stdout = f"{target_ts:.0f}\n"

        monkeypatch.setattr(
            staleness.subprocess,
            "run",
            lambda *_a, **_kw: FakeResult(),
        )

        fake_path = tmp_path / "anything.json"
        fake_path.write_text("x")
        assert abs(staleness._last_modified(fake_path) - target_ts) < 1.0

    def test_falls_back_to_mtime_when_git_unavailable(self, tmp_path, monkeypatch):
        def boom(*_a, **_kw):
            raise FileNotFoundError("git not on PATH")

        monkeypatch.setattr(staleness.subprocess, "run", boom)

        fake_path = tmp_path / "anything.json"
        fake_path.write_text("x")
        target_ts = time.time() - 5 * 86_400
        os.utime(fake_path, (target_ts, target_ts))
        assert abs(staleness._last_modified(fake_path) - target_ts) < 1.0
