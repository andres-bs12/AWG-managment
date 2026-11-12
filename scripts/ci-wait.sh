#!/usr/bin/env bash
# Waits for the GitHub Actions run of the current commit and exits non-zero unless it succeeds.
# Run it after every push: an empty run list is an error, never "not started yet".
set -euo pipefail
sha=$(git rev-parse HEAD)
id=""
for _ in $(seq 1 30); do
  id=$(gh run list --commit "$sha" --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  [ -n "$id" ] && break
  sleep 10
done
if [ -z "$id" ]; then
  echo "CI: no run found for $sha after 5 minutes. Check that the push reached GitHub and Actions is enabled." >&2
  exit 2
fi
echo "CI run $id for ${sha:0:7}: https://github.com/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/actions/runs/$id"
if gh run watch "$id" --exit-status --interval 30 > /dev/null; then
  echo "CI: success"
else
  echo "CI: FAILED. Failing steps:" >&2
  gh run view "$id" --log-failed 2>&1 | grep -iE "error|fail|✘" | head -40 >&2
  exit 1
fi
