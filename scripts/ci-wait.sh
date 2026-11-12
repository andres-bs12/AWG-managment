#!/usr/bin/env bash
# Waits for EVERY GitHub Actions run of the current commit (push and pull_request) and exits
# non-zero unless all succeed. A PR run skips e2e, so one green run alone proves nothing.
# Run it after every push: an empty run list is an error, never "not started yet".
set -euo pipefail
sha=$(git rev-parse HEAD)
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
ids=""
for _ in $(seq 1 30); do
  ids=$(gh run list --commit "$sha" --workflow CI --json databaseId --jq '.[].databaseId')
  [ -n "$ids" ] && break
  sleep 10
done
if [ -z "$ids" ]; then
  echo "CI: no run found for $sha after 5 minutes. Check that the push reached GitHub and Actions is enabled." >&2
  exit 2
fi
sleep 20 # a second run (push vs pull_request) may register a little later
ids=$(gh run list --commit "$sha" --workflow CI --json databaseId --jq '.[].databaseId')
failed=0
for id in $ids; do
  event=$(gh run view "$id" --json event --jq .event)
  echo "CI run $id ($event) for ${sha:0:7}: https://github.com/$repo/actions/runs/$id"
  if ! gh run watch "$id" --exit-status --interval 30 > /dev/null; then
    failed=1
    echo "CI: run $id FAILED. Failing steps:" >&2
    { gh run view "$id" --log-failed 2>&1 | grep -iE "[0-9]+ (passed|failed|flaky)|error:|✘" | head -40 >&2; } || true
  fi
  gh run view "$id" --json jobs --jq '.jobs[] | "  \(.name): \(.conclusion)"'
done
[ "$failed" = 0 ] && echo "CI: all runs green (check above that e2e ran and was not skipped)" || exit 1
