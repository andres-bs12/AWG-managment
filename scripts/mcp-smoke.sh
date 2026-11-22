#!/usr/bin/env bash
# Post-deploy check of the Claude connector (MCP) without any password.
# Usage: scripts/mcp-smoke.sh [base-url]   (default https://artwithgab.com)
# Optional: MCP_TOKEN=<connector access token> also lists the tools over /mcp.
set -u
BASE="${1:-https://artwithgab.com}"
CALLBACK="https://claude.ai/api/mcp/auth_callback"
fail=0
pass() { printf '  ok   %s\n' "$1"; }
bad() { printf '  FAIL %s\n' "$1"; fail=1; }

echo "MCP smoke test against $BASE"

headers=$(curl -s -D - -o /dev/null -X POST "$BASE/mcp" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
echo "$headers" | head -1 | grep -q ' 401' && pass "/mcp without token is 401" || bad "/mcp without token is not 401"
echo "$headers" | grep -qi "www-authenticate: Bearer resource_metadata=\"$BASE/.well-known/oauth-protected-resource/mcp\"" \
  && pass "401 points to the resource metadata" || bad "WWW-Authenticate header missing or wrong"

curl -s "$BASE/.well-known/oauth-protected-resource/mcp" | grep -q "\"resource\":\"$BASE/mcp\"" \
  && pass "protected-resource metadata" || bad "protected-resource metadata"
curl -s "$BASE/.well-known/oauth-authorization-server" | grep -q "\"token_endpoint\":\"$BASE/oauth/token\"" \
  && pass "authorization-server metadata" || bad "authorization-server metadata"

client=$(curl -s -X POST "$BASE/oauth/register" -H 'Content-Type: application/json' \
  -d "{\"client_name\":\"smoke\",\"redirect_uris\":[\"$CALLBACK\"]}")
client_id=$(printf '%s' "$client" | sed -n 's/.*"client_id":"\([^"]*\)".*/\1/p')
[ -n "$client_id" ] && pass "client registration (claude.ai callback)" || bad "client registration: $client"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/oauth/register" -H 'Content-Type: application/json' \
  -d '{"redirect_uris":["https://evil.example/cb"]}')
[ "$code" = 400 ] && pass "foreign redirect URI refused" || bad "foreign redirect URI got $code"

challenge="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
page=$(curl -s -D - "$BASE/oauth/authorize?response_type=code&client_id=${client_id:-x}&redirect_uri=$CALLBACK&code_challenge=$challenge&code_challenge_method=S256&state=s&resource=$BASE/mcp")
echo "$page" | grep -q 'Connect Claude to ArtWithGab' && pass "sign-in page renders" || bad "sign-in page"
echo "$page" | grep -i '^content-security-policy' | grep -q "form-action 'self' https://claude.ai" \
  && pass "sign-in page may redirect to claude.ai (CSP)" || bad "CSP blocks the redirect to claude.ai"
[ "$(echo "$page" | grep -ci '^content-security-policy')" = 1 ] && pass "exactly one CSP header (nginx did not add the site CSP)" \
  || bad "more than one CSP header on the sign-in page"

code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer not-a-token' "$BASE/api/orders/attention")
[ "$code" = 401 ] && pass "staff API still needs a staff token" || bad "staff API answered $code to a fake token"

if [ -n "${MCP_TOKEN:-}" ]; then
  tools=$(curl -s -X POST "$BASE/mcp" -H "Authorization: Bearer $MCP_TOKEN" -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
  echo "$tools" | grep -q '"list_market_stock"' && pass "tools/list with the connector token" || bad "tools/list: $tools"
fi

[ $fail = 0 ] && echo "All checks passed." || echo "Some checks failed."
exit $fail
