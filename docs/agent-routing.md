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
codex exec -m gpt-6.1-sol -c model_reasoning_effort=high -s workspace-write "<task>" < /dev/null
# Codex (audit, read-only)
codex exec -s read-only -m gpt-6.1-sol -c model_reasoning_effort=medium "<review brief>" < /dev/null
# GLM / DeepSeek through Vibe (read-only: only read tools). Models: glm-5-3 | zai-glm-5-3-flash | deepseek-v4-1-flash
PATH="$HOME/.local/bin:$PATH" vibe --trust --model glm-5-3 --enabled-tools read_file --enabled-tools grep \
  --max-turns 60 --time-limit 1500 -p "<brief>" < /dev/null
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
| 2026-11-06 | Multi-layer UI fix (public mobile: scrolling, 4-step /buy, single name) | Codex gpt-6.1-sol high | B | Root cause right; Claude review found 3 P1 (name field could not be emptied, two name inputs, legacy back names); E2E 132/132 on WebKit phones after fixes. |
| 2026-11-06 | Fix list from review (10 items, front + back) | Codex gpt-6.1-sol high | B | All 10 done, backend 107 tests; left 117 E2E failures (axe contrast after layout change, stale specs) for Claude to find. |
| 2026-11-06 | Read-only review of Codex diff | Claude subagent (general-purpose) | A | 10 findings, the 3 P1 confirmed real. |
| 2026-11-06 | Staff UX overhaul + sales list + painting hours (front + back + V11) | Codex gpt-6.1-sol high | B | Finished code and tests (backend 119) but hit the ChatGPT usage limit while writing docs; 234k tokens. Split big briefs in two next time. |
| 2026-11-06 | Read-only backend/front review (Vibe) | GLM-5.3 | B | Run 1 stopped at 30 turns with no report; run 2 (60 turns, narrow file list) gave 3 P2: 2 real (NUL in search, inexact quarter-hour check), 1 false positive (N+1 already batched). |
| 2026-11-06 | Same read-only review, for comparison (Vibe) | DeepSeek V4.1 Flash | C | Finished in one run (60 turns). 7 findings: 1 real P2 (sales ?page past the end), 1 by-design (review orders not in Unpaid), 5 false positives (N+1 already batched, string deps, per-item undo exists, exact float for quarters, over-limit warning lives in Agenda). GLM-5.3 stays the third auditor. |
| 2026-11-06 | Fix 40 E2E failures + 2 Agenda rule violations | Codex gpt-6.1-sol high | B | 40 → 6 (3 stale snapshots, 1 old test contradicting its new item-level filter, fixed by Claude). Good per-test diagnosis (most were weekday-comma selectors). Missed on review: pay button broke mid-word at 360px, repeated pet name and colour word on the review card, `<html lang>` always `en`. |
| 2026-11-06 | Staff phone polish (5 defects from Claude's 360px screenshots) | Codex gpt-6.1-sol high | B | All 5 done, 690/693 E2E first run (1 load flake). Claude's screenshot review found 2 regressions: `StaffText` split dates ("Sat, 28 / Nov") and inventory swatch as a lone header; fixed by Claude. |
| 2026-11-07 | Public /buy and /form vertical rhythm (owner: odd spacing, big gap at form end) | Codex gpt-6.1-sol high | B | Rhythm 8/24/32 px, duplicate heading removed, review row fixed; looked right in real-phone captures. Missed: hover preview showed a phantom choice after a layout shift (journey-deep failed), fixed by Claude. |
| 2026-11-08 | Backend invoices + delivery window (V8, outbox, tests) | Codex gpt-6.1-sol high | B | 103 tests green; GLM audit found real gaps (placeholder seller data would be e-mailed, unbounded retries), fixed by Claude. `--full-auto` no longer exists: use `-s workspace-write`. |
| 2026-11-08 | Multi-ornament UX redesign (/buy, /form) | Codex gpt-6.1-sol high | C | Built to brief, but Claude's screenshot review found the list pushed the editor off the first phone screen with one ornament, a duplicate heading and an empty desktop column; reworked by Claude (list only with 2+), 12 specs adjusted. |
| 2026-11-08 | Public UX writing pass + thanks page + 1–5 scale (GLM via Vibe, accept-edits) | GLM-5.3 | B | Good first-person German copy with a before→after table; could not run node/npm in Vibe (approval denied), so code was unbuilt; 2 spec breaks and hard-coded scale labels fixed by Claude. |
| 2026-11-08 | Read-only audit of invoice backend | GLM-5.3 | A | 5 findings: 3 real (placeholder data, retry cap, retention conflict), 1 false positive (lock contention), 1 design note. |

## Routing changes

| Date | Change | Reason |
|---|---|---|
| 2026-11-06 | Initial table; astra moved to medium for complex work | Owner's decision |
| 2026-11-06 | Mistral's own models removed from routing | Owner: not good enough |
| 2026-11-06 | GLM-5.3, GLM-5.3 Flash and DeepSeek V4.1 Flash added via Vibe | Included in the owner's Mistral plan |
| 2026-11-08 | GLM via Vibe implementation briefs must not rely on running node/npm: Claude builds and tests afterwards | Vibe denied every node/npm call in accept-edits mode |

## Setup status

- Claude Code: ✅
- Codex CLI: ✅
- Mistral Vibe 3.1: ✅ `~/.local/bin/vibe`, signed in (key in the macOS Keychain). Plan: Education, €127.50/month Vibe Code + €12.75/month API, resets on the 1st; pay-as-you-go **off**.
- GLM-5.3 and GLM-5.3 Flash: ✅ built into Vibe.
- DeepSeek V4.1 Flash: ✅ added by hand to `~/.vibe/config.toml` (`[models.deepseek-v4-1-flash]`, API id `deepseek-v4-1-flash-1017`, public preview). Unknown yet whether it draws from the Vibe or the API allowance — check admin.mistral.ai/subscription after real use.
