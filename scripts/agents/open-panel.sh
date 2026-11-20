#!/bin/bash
# Starts the agent panel server (if needed) and opens it as a narrow window on the
# right edge of the screen. Idempotent: does nothing if the panel is already open.
# Override: AGENTS_PORT, AGENTS_PANEL_W, AGENTS_PANEL_H, AGENTS_PANEL_X, AGENTS_PANEL_Y.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${AGENTS_PORT:-4747}"
URL="http://localhost:$PORT"
W="${AGENTS_PANEL_W:-360}"

mkdir -p "$HOME/.awg-agents"
if ! curl -s -m 1 -o /dev/null "$URL/api/open"; then
  nohup node "$ROOT/scripts/agents/dashboard-server.mjs" >> "$HOME/.awg-agents/server.log" 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -s -m 1 -o /dev/null "$URL/api/open" && break; sleep 0.3; done
fi

# Already on screen (the page polls /api/runs every 1.5 s)? Then leave it alone.
if curl -s -m 1 "$URL/api/open" | grep -q '"viewing":true'; then exit 0; fi

# Desktop bounds (all displays): "left, top, right, bottom". Default: right edge, full height.
read -r _ TOP RIGHT BOTTOM < <(osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null | tr -d ',')
RIGHT="${RIGHT:-1440}"; BOTTOM="${BOTTOM:-900}"; TOP="${TOP:-0}"
X="${AGENTS_PANEL_X:-$((RIGHT - W))}"
Y="${AGENTS_PANEL_Y:-$((TOP + 30))}"
H="${AGENTS_PANEL_H:-$((BOTTOM - TOP - 60))}"

# Own Chrome profile: the flags are honored and your normal Chrome windows are untouched.
open -na "Google Chrome" --args \
  --user-data-dir="$HOME/.awg-agent-panel" --no-first-run --no-default-browser-check \
  --app="$URL" --window-size="$W,$H" --window-position="$X,$Y"
