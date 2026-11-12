#!/usr/bin/env bash
# Local end-to-end test of the web shop with Stripe TEST mode.
# Usage: STRIPE_SECRET_KEY=sk_test_xxx ./scripts/stripe-dev.sh
# Needs: Stripe CLI (`brew install stripe/stripe-cli/stripe`, then `stripe login`), local PostgreSQL db awg_tracking.
set -euo pipefail

if [[ -z "${STRIPE_SECRET_KEY:-}" || "${STRIPE_SECRET_KEY}" != sk_test_* ]]; then
  echo "Set STRIPE_SECRET_KEY to a TEST key (sk_test_...)." >&2
  exit 1
fi
command -v stripe >/dev/null || { echo "Install the Stripe CLI: brew install stripe/stripe-cli/stripe" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EVENTS="checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired"

# The CLI prints a temporary signing secret for this forwarding session.
WHSEC="$(stripe listen --api-key "$STRIPE_SECRET_KEY" --print-secret)"
echo "Forwarding Stripe events to http://localhost:8080/api/shop/stripe/webhook"
stripe listen --api-key "$STRIPE_SECRET_KEY" --events "$EVENTS" \
  --forward-to http://localhost:8080/api/shop/stripe/webhook &
LISTEN_PID=$!
trap 'kill $LISTEN_PID 2>/dev/null || true' EXIT

cd "$ROOT/awg-tracking"
SHOP_ENABLED=true \
STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
STRIPE_WEBHOOK_SECRET="$WHSEC" \
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:5174}" \
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
