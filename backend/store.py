"""Lightweight JSON persistence for roster and batting-order state.

The store file lives under ``backend/data/`` and is rewritten atomically on
every mutation so a process crash mid-write can't leave a truncated file.
If the file is missing (first run), callers seed defaults and ``save``.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

STORE_PATH = Path(__file__).resolve().parent / "data" / "app_state.json"


def load() -> dict[str, Any] | None:
    """Return the saved state dict, or None if nothing is stored yet."""
    if not STORE_PATH.exists():
        return None
    try:
        return json.loads(STORE_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def save(state: dict[str, Any]) -> None:
    """Atomically write ``state`` to the store path."""
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(state, indent=2) + "\n"
    fd, tmp_name = tempfile.mkstemp(
        dir=STORE_PATH.parent,
        prefix=".app_state.",
        suffix=".tmp",
    )
    try:
        with os.fdopen(fd, "w") as tmp:
            tmp.write(payload)
            tmp.flush()
            os.fsync(tmp.fileno())
        os.replace(tmp_name, STORE_PATH)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
