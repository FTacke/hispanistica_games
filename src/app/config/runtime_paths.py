"""Helpers for runtime paths in repo-root and production-shaped layouts."""

from __future__ import annotations

import os
from pathlib import Path


DEFAULT_REPO_ROOT = Path(__file__).resolve().parents[3]
RUNTIME_SENTINELS = ("config", "data", "logs", "media")


def _resolve_path(path_value: str | Path) -> Path:
    return Path(path_value).expanduser().resolve()


def get_repo_root(repo_root: str | Path | None = None) -> Path:
    return _resolve_path(repo_root or DEFAULT_REPO_ROOT)


def _is_filesystem_root(path: Path) -> bool:
    return path.parent == path


def get_runtime_root(repo_root: str | Path | None = None) -> Path:
    repo_root_path = get_repo_root(repo_root)

    explicit_root = os.getenv("GAMES_BASE_DIR") or os.getenv("APP_RUNTIME_ROOT")
    if explicit_root:
        return _resolve_path(explicit_root)

    if repo_root_path.name.lower() == "app":
        candidate_root = repo_root_path.parent
        if not _is_filesystem_root(candidate_root) and any(
            (candidate_root / name).exists() for name in RUNTIME_SENTINELS
        ):
            return candidate_root

    return repo_root_path


def _get_runtime_dir(
    env_names: tuple[str, ...],
    default_name: str,
    repo_root: str | Path | None = None,
) -> Path:
    for env_name in env_names:
        value = os.getenv(env_name)
        if value:
            return _resolve_path(value)

    return get_runtime_root(repo_root) / default_name


def get_data_dir(repo_root: str | Path | None = None) -> Path:
    return _get_runtime_dir(("GAMES_DATA_DIR",), "data", repo_root)


def get_logs_dir(repo_root: str | Path | None = None) -> Path:
    return _get_runtime_dir(("GAMES_LOGS_DIR",), "logs", repo_root)


def get_media_dir(repo_root: str | Path | None = None) -> Path:
    return _get_runtime_dir(("MEDIA_ROOT", "MEDIA_DIR", "GAMES_MEDIA_DIR"), "media", repo_root)


def get_db_dir(repo_root: str | Path | None = None) -> Path:
    return get_data_dir(repo_root) / "db"