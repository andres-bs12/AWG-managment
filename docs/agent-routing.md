# Agent routing — which model does what

**Purpose:** base document for splitting work across our subscriptions (Claude, ChatGPT/Codex, Mistral Education plan — used only for the GLM and DeepSeek models it hosts). It learns: after each delegated task, add a line to the results log and adjust the routing table when the evidence says so.

**Owner of this file:** the orchestrator (Claude Opus). Update it at the end of each sprint at the latest.

## Roles

| Role | Model / tool | Use for |
|---|---|---|
| Orchestrator | **Claude Opus** (Claude Code) | Plans, splits work, delegates, merges results, decides. Does the hard parts itself: delicate backend, security, integration, browser/Playwright, computer use. Final word on every change. |
| Complex implementation (peer) | **Codex `gpt-6.1-astra`, effort medium** | Hard features or refactors when Opus is busy orchestrating. Expensive: only for genuinely complex work. |
| Standard implementation | **Codex `gpt-6.1-sol`, medium / high** | Most features and fixes. High when the task spans several layers or files. |
| Easy / mechanical work | **GLM-5.3 Flash** or **DeepSeek V4.1 Flash** (via Vibe) | Renames, copy edits, small tests, boilerplate, docs touch-ups. Compare both in the log. |
| Medium work / third auditor | **GLM-5.3** (via Vibe) | Single-file features; independent read-only reviews (different family from Claude and GPT). |
| Images and visual review | **Codex `gpt-6.1-terra`** / **ChatGPT** | Image generation, reading screenshots, visual critique. |

Constants that do not change:
- **Cross-LLM audit:** the reviewer is never the model family that wrote the code. Claude code → Codex or GLM/DeepSeek audits. Codex code → Claude or GLM/DeepSeek audits.
- Codex cannot open ports: Playwright and the browser always run on Claude.
- Mistral's own models (Large 4, Medium) are **not used** (owner: not good enough).
- Nobody pastes secrets into prompts or chat. Each CLI uses the login stored on this Mac.

## How to call each one

```bash
# Codex (implementation)
codex exec -m gpt-6.1-sol -c model_reasoning_effort=high "<task>" < /dev/null
# Codex (audit, read-only)
codex exec -s read-only -m gpt-6.1-sol -c model_reasoning_effort=medium "<review brief>" < /dev/null
# GLM / DeepSeek through Vibe (read-only: only read tools). Models: glm-5-3 | zai-glm-5-3-flash | deepseek-v4-1-flash
PATH="$HOME/.local/bin:$PATH" vibe --trust --model glm-5-3 --enabled-tools read_file --enabled-tools grep \
  --max-turns 20 --time-limit 900 -p "<brief>" < /dev/null
# For implementation drop --enabled-tools and add --agent accept-edits (still review the diff afterwards).
```

Every brief says: files/area, what done looks like, and "do not edit" for audits.

## Learning loop

1. Before delegating, pick the model from the routing table.
2. After it finishes, Opus checks the result (diff, tests, verified findings) and adds **one line** to the log below.
3. Score: **A** usable as is · **B** needed small fixes · **C** needed rework · **F** discarded. For audits, also count real findings vs false positives.
4. Each sprint, review the log. If a model gets ≥2 C/F results in one task type, move that task type to another model. If a cheaper model gets A/B consistently, move work down to it. Record each change under "Routing changes".

## Results log

| Date | Task type | Model | Score | Notes |
|---|---|---|---|---|
| 2026-11-06 | Read-only review (small TS file) | Mistral Vibe (default model) | B | 3 plausible findings on `pickupTimes.ts`, unverified. Owner dropped Mistral's own models. |
| 2026-11-06 | Smoke test (one-line summary) | GLM-5.3 / GLM-5.3 Flash / DeepSeek V4.1 Flash | A | All three answered correctly headless. |

## Routing changes

| Date | Change | Reason |
|---|---|---|
| 2026-11-06 | Initial table; astra moved to medium for complex work | Owner's decision |
| 2026-11-06 | Mistral's own models removed from routing | Owner: not good enough |
| 2026-11-06 | GLM-5.3, GLM-5.3 Flash and DeepSeek V4.1 Flash added via Vibe | Included in the owner's Mistral plan |

## Setup status

- Claude Code: ✅
- Codex CLI: ✅
- Mistral Vibe 3.1: ✅ `~/.local/bin/vibe`, signed in (key in the macOS Keychain). Plan: Education, €127.50/month Vibe Code + €12.75/month API, resets on the 1st; pay-as-you-go **off**.
- GLM-5.3 and GLM-5.3 Flash: ✅ built into Vibe.
- DeepSeek V4.1 Flash: ✅ added by hand to `~/.vibe/config.toml` (`[models.deepseek-v4-1-flash]`, API id `deepseek-v4-1-flash-1017`, public preview). Unknown yet whether it draws from the Vibe or the API allowance — check admin.mistral.ai/subscription after real use.
