#!/usr/bin/env bash
# Prints the GitHub Actions result for the latest PUSH run of this branch (used at session start).
# Pull-request runs skip e2e, so they are ignored here: only a push run proves the full suite.
# Never fails: problems are printed as text the agent must act on.
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
command -v gh > /dev/null || { echo "CI status unknown: gh is not installed."; exit 0; }
json=$(gh run list --branch "$branch" --workflow CI --event push --limit 1 --json status,conclusion,headSha,url 2>&1) \
  || { echo "CI status unknown for $branch: $json"; exit 0; }
if [ "$json" = "[]" ]; then echo "CI: no push run found for branch $branch. Investigate before calling anything green."; exit 0; fi
status=$(echo "$json" | jq -r '.[0].status'); conclusion=$(echo "$json" | jq -r '.[0].conclusion')
sha=$(echo "$json" | jq -r '.[0].headSha[0:7]'); url=$(echo "$json" | jq -r '.[0].url')
case "$conclusion" in
  success) echo "CI: green on $branch ($sha).";;
  ""|null) echo "CI: still $status on $branch ($sha): $url. Run scripts/ci-wait.sh in the background and report the result.";;
  *) echo "CI FAILED on $branch ($sha, $conclusion): $url. Fix it before any other work (gh run view --log-failed).";;
esac
