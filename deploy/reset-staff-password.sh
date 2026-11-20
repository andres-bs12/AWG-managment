#!/bin/bash
# Resets one staff account's password in production. Run it yourself in a terminal:
#   deploy/reset-staff-password.sh andres@artwithgab.com
# The new password is typed here (hidden), hashed with bcrypt on this Mac and only the hash is sent to the
# server. All open sessions of that account are signed out. Host and key: AWG_HOST / AWG_KEY.
set -euo pipefail
EMAIL="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
[[ "$EMAIL" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+$ ]] || { echo "usage: $0 <staff email>"; exit 2; }
HOST="${AWG_HOST:-ubuntu@13.62.252.19}"
KEY="${AWG_KEY:-$HOME/.ssh/awg-tracking}"

read -rsp "New password for $EMAIL (at least 10 characters, at most 72 bytes): " PW; echo
read -rsp "Repeat it: " PW2; echo
[[ "$PW" == "$PW2" ]] || { echo "The passwords do not match."; exit 1; }
(( ${#PW} >= 10 )) || { echo "Use at least 10 characters."; exit 1; }
(( $(printf '%s' "$PW" | wc -c) <= 72 )) || { echo "Use at most 72 bytes."; exit 1; }

# htpasswd prints ":$2y$..." for an empty user name; Spring's BCrypt accepts the $2y$ prefix.
HASH="$(htpasswd -inBC 12 "" <<<"$PW" | tr -d ':\n')"
unset PW PW2
[[ "$HASH" == \$2y\$* ]] || { echo "Could not hash the password."; exit 1; }

ssh -i "$KEY" -o ConnectTimeout=10 "$HOST" bash -s -- "$EMAIL" "$HASH" <<'REMOTE'
set -euo pipefail
cd /opt/awg
sudo docker compose --env-file .env exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v email="$1" -v hash="$2"' sh "$1" "$2" <<'SQL'
BEGIN;
UPDATE staff_user SET password_hash = :'hash' WHERE lower(email) = :'email';
DELETE FROM staff_session WHERE staff_user_id IN (SELECT id FROM staff_user WHERE lower(email) = :'email');
SELECT count(*) AS accounts_updated FROM staff_user WHERE lower(email) = :'email' AND password_hash = :'hash';
COMMIT;
SQL
REMOTE
echo "Done. Sign in at https://artwithgab.com/staff/login with the new password."
