#!/usr/bin/env bash
# Build AWG images on this machine (arm64, same as the t4g server), ship them over SSH and restart.
# Usage: deploy/deploy.sh            (host and key can be overridden with AWG_HOST / AWG_KEY)
set -euo pipefail

HOST="${AWG_HOST:-ubuntu@13.62.252.19}"
KEY="${AWG_KEY:-$HOME/.ssh/awg-tracking}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="$(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet HEAD -- awg-tracking frontend || echo -dirty)"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$HOST")

echo "==> Building images (tag $TAG)"
docker build --platform linux/arm64 -q -t "awg-backend:$TAG" "$ROOT/awg-tracking"
docker build --platform linux/arm64 -q -t "awg-frontend:$TAG" "$ROOT/frontend"

echo "==> Uploading images"
docker save "awg-backend:$TAG" "awg-frontend:$TAG" | gzip -1 | "${SSH[@]}" 'gunzip | docker load -q'

echo "==> Writing compose file"
sed -e "s#build: ./awg-tracking#image: awg-backend:$TAG#" \
    -e "s#build: ./frontend#image: awg-frontend:$TAG#" \
    "$ROOT/docker-compose.yml" | "${SSH[@]}" 'cat > /opt/awg/docker-compose.yml'

echo "==> Restarting"
"${SSH[@]}" 'cd /opt/awg && test -f .env && docker compose --env-file .env up -d --remove-orphans && docker image prune -f >/dev/null'

echo "==> Waiting for the backend health check"
for _ in $(seq 1 40); do
  if "${SSH[@]}" 'curl -fsS http://127.0.0.1:8081/api/health' >/dev/null 2>&1; then
    echo "Deployed $TAG"; exit 0
  fi
  sleep 5
done
echo "Backend did not become healthy; check: ssh ... 'cd /opt/awg && docker compose logs --tail 100 backend'" >&2
exit 1
