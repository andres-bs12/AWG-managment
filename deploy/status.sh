#!/usr/bin/env bash
# One-screen health report for the AWG production server (read-only).
# Needs: `aws login --region eu-north-1` and the SSH key ~/.ssh/awg-tracking.
set -uo pipefail

HOST="${AWG_HOST:-ubuntu@13.62.252.19}"
KEY="${AWG_KEY:-$HOME/.ssh/awg-tracking}"
SITE="${AWG_SITE:-https://artwithgab.com}"
export AWS_REGION="${AWS_REGION:-eu-north-1}" AWS_PAGER=""

section() { printf '\n== %s\n' "$1"; }

section "Website"
printf 'health: %s\n' "$(curl -s -m 10 "$SITE/api/health" || echo UNREACHABLE)"
printf 'home:   HTTP %s\n' "$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$SITE/")"

section "AWS"
aws ec2 describe-instances --filters Name=tag:project,Values=awg \
  --query 'Reservations[].Instances[].[Tags[?Key==`Name`]|[0].Value,InstanceType,State.Name,PublicIpAddress]' \
  --output text 2>&1
aws freetier get-account-plan-state --region us-east-1 \
  --query '[accountPlanType, accountPlanRemainingCredits.amount, accountPlanExpirationDate]' --output text 2>&1 \
  | awk '{printf "plan: %s  credits left: %s USD  expires: %s\n", $1, $2, $3}'
printf 'snapshots: '
aws ec2 describe-snapshots --owner-ids self --filters Name=tag:project,Values=awg \
  --query 'reverse(sort_by(Snapshots,&StartTime))[0].[StartTime,State]' --output text 2>&1

section "Server"
ssh -i "$KEY" -o ConnectTimeout=10 "$HOST" '
  uptime -p
  free -h | awk "NR==2{print \"memory: \"\$3\" used / \"\$2} NR==3{print \"swap:   \"\$3\" used / \"\$2}"
  df -h / | awk "NR==2{print \"disk:   \"\$3\" used / \"\$2\" (\"\$5\")\"}"
  cd /opt/awg && docker compose ps --format "{{.Service}}: {{.Status}}"
  echo "recent backend errors: $(docker compose logs --since 24h backend 2>/dev/null | grep -c " ERROR ")"
  sudo find /var/lib/caddy -name "artwithgab.com.crt" -exec openssl x509 -noout -enddate -in {} \; | sed "s/notAfter=/certificate until: /"
' 2>&1
