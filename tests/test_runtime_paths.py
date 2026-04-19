from __future__ import annotations

import os
from pathlib import Path

from src.app.config.runtime_paths import get_runtime_root


def test_runtime_root_prefers_parent_workspace_when_repo_is_nested(tmp_path, monkeypatch):
    monkeypatch.delenv("GAMES_BASE_DIR", raising=False)
    monkeypatch.delenv("APP_RUNTIME_ROOT", raising=False)

    workspace_root = tmp_path / "games.hispanistica"
    repo_root = workspace_root / "app"
    repo_root.mkdir(parents=True)
    (workspace_root / "data").mkdir()

    assert get_runtime_root(repo_root) == workspace_root.resolve()


def test_runtime_root_never_promotes_filesystem_root(monkeypatch):
    monkeypatch.delenv("GAMES_BASE_DIR", raising=False)
    monkeypatch.delenv("APP_RUNTIME_ROOT", raising=False)

    repo_root = (Path(os.path.sep) / "app").resolve()
    root_path = repo_root.parent

    original_exists = Path.exists

    def fake_exists(self: Path) -> bool:
        if self == root_path / "media":
            return True
        return original_exists(self)

    monkeypatch.setattr(Path, "exists", fake_exists)

    assert get_runtime_root(repo_root) == repo_root


def test_runtime_root_honors_explicit_override(monkeypatch):
    monkeypatch.setenv("APP_RUNTIME_ROOT", "/app")

    assert get_runtime_root(Path("/different/repo/app")) == Path("/app").resolve()