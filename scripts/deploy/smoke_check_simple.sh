#!/bin/bash
set -e

echo "=== Smoke Check ==="

# Check container
if ! docker ps --format '{{.Names}}' | grep -q '^games-web-prod$'; then
  echo "✗ Container not running"
  exit 1
fi
echo "✓ Container running"

# Check health with retries
for i in {1..10}; do
  if curl -sf http://127.0.0.1:7000/health | grep -q '"status"'; then
    echo "✓ Health OK"
    exit 0
  fi
  echo "  Attempt $i/10..."
  sleep 2
done

echo "✗ Health check failed"
exit 1
