"""Standards library loader.

Single source of truth for loading and locating the standards library.
Handles path resolution so no other module needs to know where the file lives.
"""

from __future__ import annotations

import json
from pathlib import Path

_STANDARDS_DIR = Path(__file__).parent
_DEFAULT_PATH = _STANDARDS_DIR / "standards_library.json"


def load_standards(path: Path | str | None = None) -> dict:
    """Load the standards library from JSON.

    Checks in order:
      1. Explicit path argument
      2. Bundled library in this package directory
      3. ./standards_library.json in the current working directory

    Raises FileNotFoundError if no library is found.
    """
    candidates = [
        Path(path) if path else None,
        _DEFAULT_PATH,
        Path.cwd() / "standards_library.json",
    ]

    for candidate in candidates:
        if candidate and candidate.exists():
            with open(candidate) as f:
                return json.load(f)

    raise FileNotFoundError(
        "Standards library not found. Looked in:\n"
        + "\n".join(f"  {c}" for c in candidates if c)
    )


def get_standards_path() -> Path:
    """Return the path to the bundled standards library."""
    return _DEFAULT_PATH
