"""Surgical patch: add per-standard versioning to standards_library.json.

Adds two fields to every standard in the library:
  - version: string (starts at the current library version "4.6.1")
  - version_history: list of {version, date, change_note}

Human-eval build plan Session 1. Per-standard versioning is the hard
precondition the novel corpus's "as-of-revision" claims depend on.
Additive only — existing fields are preserved verbatim; the file
structure is never replaced wholesale.

Usage:
    python3 tools/patch_add_per_standard_versioning.py

Re-run safety: if every standard already has a `version` field, the
script exits without writing. Otherwise it backs up to .bak and
writes in place.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path


LIBRARY_PATH = Path("src/content_checker/standards/standards_library.json")
INITIAL_VERSION = "4.6.1"
INITIAL_DATE = "2026-04-23"
INITIAL_NOTE = (
    "Per-standard version tracking introduced. Every standard starts at "
    "the library version current at introduction; bump per-standard when "
    "the rule text, examples, or content_type_notes change."
)


def iter_standards(data: dict):
    for cat in data.get("categories", []):
        for std in cat.get("standards", []):
            yield std


def patch(data: dict) -> int:
    patched = 0
    for std in iter_standards(data):
        if "version" in std and "version_history" in std:
            continue
        std.setdefault("version", INITIAL_VERSION)
        history = std.setdefault("version_history", [])
        if not history:
            history.append(
                {
                    "version": INITIAL_VERSION,
                    "date": INITIAL_DATE,
                    "change_note": INITIAL_NOTE,
                }
            )
        patched += 1
    return patched


def main() -> int:
    if not LIBRARY_PATH.exists():
        print(f"ERROR: {LIBRARY_PATH} not found. Run from repo root.")
        return 1

    with open(LIBRARY_PATH) as f:
        data = json.load(f)

    patched = patch(data)

    if patched == 0:
        print("No changes needed — every standard already has version fields.")
        return 0

    backup = LIBRARY_PATH.with_suffix(".json.bak")
    shutil.copy2(LIBRARY_PATH, backup)
    print(f"Backup: {backup}")

    with open(LIBRARY_PATH, "w") as f:
        # Preserve the canonical 2-space indent. The existing
        # patch_standards_library.py writes with indent=4, but the
        # committed file's actual form is 2-space.
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Patched {patched} standard(s) with per-standard version fields.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
