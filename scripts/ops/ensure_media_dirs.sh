#!/usr/bin/env bash
# Ensure media directory structure exists and has correct ownership.
# Usage:
#   MEDIA_ROOT=/srv/webapps/games_hispanistica/media MEDIA_UID=1000 MEDIA_GID=1000 \
#     ./scripts/ops/ensure_media_dirs.sh

set -euo pipefail

MEDIA_ROOT=${MEDIA_ROOT:-/srv/webapps/games_hispanistica/media}
MEDIA_UID=${MEDIA_UID:-}
MEDIA_GID=${MEDIA_GID:-}

mkdir -p "$MEDIA_ROOT" \
  "$MEDIA_ROOT/quiz" \
  "$MEDIA_ROOT/releases" \
  "$MEDIA_ROOT/mp3-full" \
  "$MEDIA_ROOT/mp3-split" \
  "$MEDIA_ROOT/mp3-temp" \
  "$MEDIA_ROOT/transcripts"

echo "Media directories ensured under: $MEDIA_ROOT"

if [ -n "$MEDIA_UID" ] || [ -n "$MEDIA_GID" ]; then
  echo "Setting ownership to ${MEDIA_UID:-0}:${MEDIA_GID:-0}"
  chown -R "${MEDIA_UID:-0}:${MEDIA_GID:-0}" "$MEDIA_ROOT"
fi

echo "Done."