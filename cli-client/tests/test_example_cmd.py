"""Tests for `contentrx example …` subcommand group.

Human-eval build plan Session 30 PR B. Mocks `urllib.request.urlopen`
the same way test_cli.py does so nothing hits the network.
"""

from __future__ import annotations

import io
import json
import urllib.error
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from contentrx import example_cmd, main as cli_main


class _FakeResp:
    def __init__(self, body: dict[str, Any], status: int = 200) -> None:
        self._body = json.dumps(body).encode("utf-8")
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *_exc: Any) -> None:
        pass


def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONTENTRX_API_KEY", "cx_test_key_xxxx")
    monkeypatch.setenv("CONTENTRX_API_URL", "https://test.contentrx")


# ---------------------------------------------------------------------------
# add
# ---------------------------------------------------------------------------


def test_example_add_posts_expected_body(monkeypatch, capsys):
    _env(monkeypatch)
    captured: dict[str, Any] = {}

    def fake_urlopen(req, timeout=None):
        captured["method"] = req.get_method()
        captured["url"] = req.full_url
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["headers"] = dict(req.header_items())
        return _FakeResp({
            "result": {
                "example": {
                    "id": "ce_added",
                    "text": "Let's go.",
                    "verdict": "pass",
                    "moment": "confirmation",
                    "contentType": None,
                    "standardId": None,
                    "notes": "Intentional.",
                    "contributeUpstream": False,
                    "createdAt": "2026-04-24T17:00:00Z",
                    "updatedAt": "2026-04-24T17:00:00Z",
                },
            },
        })

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main([
            "example", "add", "Let's go.",
            "--verdict", "pass",
            "--moment", "confirmation",
            "--notes", "Intentional.",
        ])

    assert code == 0
    assert captured["method"] == "POST"
    assert captured["url"] == "https://test.contentrx/api/team-custom-examples"
    assert captured["body"] == {
        "text": "Let's go.",
        "verdict": "pass",
        "contribute_upstream": False,
        "moment": "confirmation",
        "notes": "Intentional.",
    }
    assert captured["headers"].get("Authorization") == "Bearer cx_test_key_xxxx"
    out = capsys.readouterr().out
    assert "ce_added" in out and "Let's go." in out


def test_example_add_sets_contribute_upstream_when_flagged(monkeypatch):
    _env(monkeypatch)
    captured: dict[str, Any] = {}

    def fake_urlopen(req, timeout=None):
        captured["body"] = json.loads(req.data.decode("utf-8"))
        return _FakeResp({"result": {"example": {
            "id": "x", "text": "t", "verdict": "pass",
            "moment": None, "contentType": None, "standardId": None,
            "notes": None, "contributeUpstream": True,
            "createdAt": "", "updatedAt": "",
        }}})

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main([
            "example", "add", "anything",
            "--verdict", "pass",
            "--contribute-upstream",
            "--json",
        ])
    assert code == 0
    assert captured["body"]["contribute_upstream"] is True


# ---------------------------------------------------------------------------
# list
# ---------------------------------------------------------------------------


def test_example_list_prints_entries(monkeypatch, capsys):
    _env(monkeypatch)

    def fake_urlopen(req, timeout=None):
        assert req.get_method() == "GET"
        return _FakeResp({
            "result": {
                "examples": [
                    {
                        "id": "ce_1",
                        "text": "Let's go.",
                        "verdict": "pass",
                        "moment": "confirmation",
                        "contentType": None,
                        "standardId": None,
                        "notes": None,
                        "contributeUpstream": False,
                        "createdAt": "", "updatedAt": "",
                    },
                ],
                "count": 1,
                "cap": 500,
            },
        })

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "list"])
    assert code == 0
    out = capsys.readouterr().out
    assert "1 of 500" in out
    assert "ce_1" in out and "Let's go." in out


def test_example_list_json_mode(monkeypatch, capsys):
    _env(monkeypatch)

    def fake_urlopen(req, timeout=None):
        return _FakeResp({
            "result": {
                "examples": [],
                "count": 0,
                "cap": 500,
            },
        })

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "list", "--json"])
    assert code == 0
    parsed = json.loads(capsys.readouterr().out)
    assert parsed == {"examples": [], "count": 0, "cap": 500}


# ---------------------------------------------------------------------------
# search
# ---------------------------------------------------------------------------


def test_example_search_passes_text_query(monkeypatch, capsys):
    _env(monkeypatch)
    captured: dict[str, Any] = {}

    def fake_urlopen(req, timeout=None):
        captured["url"] = req.full_url
        return _FakeResp({"result": {"examples": [], "count": 0, "cap": 500}})

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "search", "Hello world"])
    assert code == 0
    assert "text=" in captured["url"]
    out = capsys.readouterr().out
    assert "No custom example covers" in out


# ---------------------------------------------------------------------------
# remove
# ---------------------------------------------------------------------------


def test_example_remove_issues_delete(monkeypatch, capsys):
    _env(monkeypatch)
    captured: dict[str, Any] = {}

    def fake_urlopen(req, timeout=None):
        captured["method"] = req.get_method()
        captured["url"] = req.full_url
        return _FakeResp({"result": {"ok": True, "deleted_id": "ce_42"}})

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "remove", "ce_42"])
    assert code == 0
    assert captured["method"] == "DELETE"
    assert captured["url"].endswith("/api/team-custom-examples/ce_42")
    assert "Removed ce_42" in capsys.readouterr().out


# ---------------------------------------------------------------------------
# export + import
# ---------------------------------------------------------------------------


def test_example_export_strips_ids_and_timestamps(monkeypatch, capsys):
    _env(monkeypatch)

    def fake_urlopen(req, timeout=None):
        return _FakeResp({
            "result": {
                "examples": [
                    {
                        "id": "ce_1",
                        "text": "Let's go.",
                        "verdict": "pass",
                        "moment": "confirmation",
                        "contentType": None,
                        "standardId": None,
                        "notes": "Intentional.",
                        "contributeUpstream": False,
                        "createdAt": "2026-04-24T17:00:00Z",
                        "updatedAt": "2026-04-24T17:00:00Z",
                    },
                ],
                "count": 1,
                "cap": 500,
            },
        })

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "export"])
    assert code == 0
    parsed = json.loads(capsys.readouterr().out)
    assert parsed["schema_version"] == "1.0.0"
    entry = parsed["examples"][0]
    assert "id" not in entry
    assert "createdAt" not in entry and "created_at" not in entry
    # content_type + standard_id are snake_case for round-trip with
    # import.
    assert entry["text"] == "Let's go."
    assert entry["contribute_upstream"] is False


def test_example_import_round_trips_from_export(monkeypatch, tmp_path, capsys):
    _env(monkeypatch)
    fixture = {
        "schema_version": "1.0.0",
        "examples": [
            {
                "text": "Let's go.",
                "verdict": "pass",
                "moment": "confirmation",
                "content_type": None,
                "standard_id": None,
                "notes": "Intentional.",
                "contribute_upstream": False,
            },
            {
                "text": "Contact administrator.",
                "verdict": "violation",
                "content_type": "error_message",
                "standard_id": "VT-05",
                "notes": "Blames the user.",
                "contribute_upstream": True,
            },
        ],
    }
    path = tmp_path / "examples.json"
    path.write_text(json.dumps(fixture))

    posted_bodies: list[dict[str, Any]] = []

    def fake_urlopen(req, timeout=None):
        posted_bodies.append(json.loads(req.data.decode("utf-8")))
        return _FakeResp({"result": {"example": {
            "id": "x", "text": "x", "verdict": "pass",
            "moment": None, "contentType": None, "standardId": None,
            "notes": None, "contributeUpstream": False,
            "createdAt": "", "updatedAt": "",
        }}})

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "import", str(path)])
    assert code == 0
    assert len(posted_bodies) == 2
    # The second entry preserves standard_id + content_type +
    # contribute_upstream=true across the wire.
    assert posted_bodies[1]["standard_id"] == "VT-05"
    assert posted_bodies[1]["content_type"] == "error_message"
    assert posted_bodies[1]["contribute_upstream"] is True
    assert "Imported 2 entries" in capsys.readouterr().out


def test_example_import_skips_duplicates_by_default(monkeypatch, tmp_path, capsys):
    """By default, a 409 conflict on one entry doesn't fail the
    entire import — it increments the skipped counter and continues."""
    _env(monkeypatch)
    fixture = {
        "examples": [
            {"text": "dup", "verdict": "pass"},
            {"text": "new", "verdict": "pass"},
        ],
    }
    path = tmp_path / "examples.json"
    path.write_text(json.dumps(fixture))

    call_count = {"n": 0}

    def fake_urlopen(req, timeout=None):
        call_count["n"] += 1
        if call_count["n"] == 1:
            # Emulate the server's 409 uniqueness collision response.
            raise urllib.error.HTTPError(
                req.full_url,
                409,
                "Conflict",
                {},
                io.BytesIO(json.dumps({"error": "already exists."}).encode("utf-8")),
            )
        return _FakeResp({"result": {"example": {
            "id": "y", "text": "y", "verdict": "pass",
            "moment": None, "contentType": None, "standardId": None,
            "notes": None, "contributeUpstream": False,
            "createdAt": "", "updatedAt": "",
        }}})

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "import", str(path)])
    assert code == 0
    out = capsys.readouterr().out
    assert "Imported 1 entries" in out
    assert "skipped 1 duplicates" in out


def test_example_import_strict_mode_fails_on_duplicate(monkeypatch, tmp_path, capsys):
    _env(monkeypatch)
    fixture = {"examples": [{"text": "dup", "verdict": "pass"}]}
    path = tmp_path / "examples.json"
    path.write_text(json.dumps(fixture))

    def fake_urlopen(req, timeout=None):
        raise urllib.error.HTTPError(
            req.full_url,
            409,
            "Conflict",
            {},
            io.BytesIO(json.dumps({"error": "already exists."}).encode("utf-8")),
        )

    with patch("urllib.request.urlopen", fake_urlopen):
        code = cli_main.main(["example", "import", str(path), "--strict"])
    assert code != 0


def test_example_import_rejects_malformed_file(monkeypatch, tmp_path, capsys):
    _env(monkeypatch)
    path = tmp_path / "not-a-list.json"
    path.write_text(json.dumps({"something_else": "oops"}))

    code = cli_main.main(["example", "import", str(path)])
    assert code != 0
