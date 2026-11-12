# Agent routing — which model does what

**Purpose:** base document for splitting work across our subscriptions (Claude, ChatGPT/Codex, Mistral Education plan — used only for the GLM and DeepSeek models it hosts). It learns: after each delegated task, add a line to the results log and adjust the routing table when the evidence says so.

**Owner of this file:** the orchestrator (Claude Opus). Update it at the end of each sprint at the latest.

## Roles

| Role | Model / tool | Use for |
|---|---|---|
| Orchestrator / project manager | **Claude Opus** (Claude Code) | Owner (2026-11-11): act as project manager and delegate by default. Plans, splits work, delegates, merges results, decides. Does the hard parts itself: delicate backend, security, integration, browser/Playwright, computer use. Final word on every change. |
| Complex implementation (peer) | **Codex `gpt-6.1-astra`, effort medium** | Hard features or refactors when Opus is busy orchestrating. Expensive: only for genuinely complex work. |
| Standard implementation | **Codex `gpt-6.1-sol`, medium / high** | Most features and fixes. High when the task spans several layers or files. |
| Easy / mechanical work | **GLM-5.3 Flash** or **DeepSeek V4.1 Flash** (via Vibe) | Renames, copy edits, small tests, boilerplate, docs touch-ups. Compare both in the log. |
| Medium work / third auditor | **GLM-5.3** (via Vibe) | Single-file features; independent read-only reviews (different family from Claude and GPT). |
| Images and visual review | **Codex `gpt-6.1-terra`** / **ChatGPT** | Image generation, reading screenshots, visual critique. |
| Scoped UI implementation / auditor (non-Claude, non-GPT) | **Gemini 3.8 Flash** via Antigravity CLI `agy` | Single-component front-end work, read-only reviews of Claude or Codex code. Fallback when Codex is out of credits. |
| Last resort (temporary) | **Claude Fable 5.2** (Agent tool, `model: "fable"`) | **Only for problems no Opus subagent or Codex sol can solve** (owner, 2026-11-11). Available until Saturday 2026-11-14. Counts as Claude for the cross-LLM rule. |
| Visual / UX audits, test fixing | **Claude Opus subagent** (Agent tool, `model: "opus"`) or Codex sol | Opus can run Playwright and read screenshots; Codex sol for code audits and implementation. |

Constants that do not change:
- Process and test tiers: `docs/reglas-aprendidas.md` §0.1 (quick checks per edit, changed specs per block, full suite once per version in CI).
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
# Gemini through Antigravity (`agy models` lists ids: gemini-3.8-flash-high|medium|low)
agy --model gemini-3.8-flash-high --mode accept-edits -p "<task>" --print-timeout 1500s < /dev/null
# Codex credits: smoke-test first; the ChatGPT plan returns "You've hit your usage limit … try again at HH:MM".
codex exec -s read-only -m gpt-6.1-sol -c model_reasoning_effort=low "Reply with just OK" < /dev/null
```

Every brief says: files/area, what done looks like, and "do not edit" for audits.

## Plantilla de encargo (brief template, 2026-11-12)

Every brief is short and contains exactly:
1. **Goal** in one or two sentences, with the owner's words when they matter.
2. **Read first:** `AGENTS.md`, `docs/reglas-aprendidas.md` (+ `docs/design-system.md` for public UI).
3. **Files you may edit** (explicit list) and "do not touch anything else; other agents work in parallel".
4. **Done means:** the concrete behaviour, plus "update the E2E assertions for what you changed and run that spec on one project with `PW_PORT=<own port>`".
5. **Verify:** `npm run check` (+ `./mvnw test -Dtest=…` for backend); captures only of the screens you changed, at 360 and 1280 px, and look at them.
6. **Report in ≤ 250 words:** files, decisions to confirm, command results, capture paths. Do not commit. Never run the full suite.

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
| 2026-11-08 | iOS Safari bars + document scroll (Codex D) | Codex gpt-6.1-sol high | B | Moved public pages to document scroll and a CSS sticky action bar (needed for Safari glass); left 8 failing specs, one with a wrong radio-group boundary and one asserting a no-scroll Home that HEAD never met. Did not find the toolbar tint cause. |
| 2026-11-09 | Safari 26 toolbar band diagnosis (read-only, web research) | Codex gpt-6-astra medium | A | Found the real mechanism in WebKit `LocalFrameView::fixedContainerEdges`: viewport-sized fixed layers are sampled unless their z-index is negative. Claude verified in the WebKit source and applied it (backdrop −2, snow −1, shell `isolation`); pixel-identical in WebKit on every public screen. |
| 2026-11-09 | Same diagnosis, in parallel | Codex gpt-6.1-sol high | B | Correct mechanism and sources, but proposed a speculative sticky-probe workaround instead of the source-level exclusion. |
| 2026-11-11 | Public loader rewrite (single component) | Gemini 3.8 Flash via `agy`, accept-edits | F | Two headless runs made no edits: every shell call (even `ls`) was auto-denied; `--settings` allow rules like `command(ls *)` did not match. Only `--dangerously-skip-permissions` works, which Claude Code's safety classifier blocks. Reassigned to GLM-5.3. Use agy for read-only reviews only until a safe allow-rule syntax is found. |
| 2026-11-11 | Public loader rewrite (OrnamentLoader screen/inline + shared PetBauble) | GLM-5.3 via Vibe, accept-edits | B | Clean, in scope, compiled first time. Claude's screenshot review: the screen caption sat on the pale lower sky and was unreadable; moved under the baubles. |
| 2026-11-11 | Read-only audit of the GLM loader, diff pasted in the prompt (`--mode plan`, no tools) | Gemini 3.8 Flash via `agy` | B | 3 findings: 1 real (duplicate `aria-label` on the live region), 2 false positives (claimed Safari cannot parse `min()` inside `clamp()`; `100lvh` gap already covered by the html sky). Pasting the diff avoids the shell-permission problem. |
| 2026-11-11 | Fix stale E2E after the /buy redesign + full suite (6 projects), build, lint, node tests | Claude Fable 5.2 (subagent) | A | 8 failures fixed, all test-side, each with a clear cause (incl. a wrong `.first()` locator, not an app bug); 462/470 then only `design.png` snapshots left; node stub selector fixed. Claude regenerated and reviewed the snapshots. |
| 2026-11-11 | Pixel audit of /buy step 1 | Claude Fable 5.2 (subagent) | F | Hit the 5-hour rate limit after capturing; stopped by Claude when the owner restricted Fable to last-resort use. Reassigned to an Opus subagent. |
| 2026-11-12 | Pixel audit of /buy step 1 (8 widths × DE/EN, 311 captures, measured) | Claude Opus subagent | A | 20 defects with px evidence and fixes (duplicate ornament naming, EN truncation, chip wrap, low-contrast add button, misaligned desktop actions, bold-weight layout shift…) and the root cause of the failing speed test (remount detached the observed node). Best visual audit so far; use Opus for visual audits. |
| 2026-11-12 | Pixel audits of /buy delivery+review+thanks and /form+Track+Home | Claude Opus subagents (2, parallel) | A | 21 and 25 defects with px evidence; caught a wrong Track label ("not personalised" for named ornaments). Parallel agents shared port 5199; one switched to a temporary port by itself. |
| 2026-11-12 | Three batches of public UI fixes from those audits (20 + 21 + 25 items) | Codex gpt-6.1-sol high | B | All items implemented, tsc/lint clean, ~150k tokens per batch. Opus cross-review found 10 real regressions (review Back flicker loop, Track address fields lost spacing, focus lost on Track miss dialog, photo remove target over the add tile, staff HelpTip changed despite the brief, colour label bug surfaced) and the full suite showed 9 failing specs. |
| 2026-11-12 | Cross-review of the Codex batches (read-only) | Claude Opus subagent | A | 10 findings, all concrete with failure scenarios; hit the 5-hour limit once and resumed. |
| 2026-11-12 | Pre-release security review (read-only) | Claude Fable 5.2 (last resort, owner-requested) | A | Found the release blocker nobody else saw: the branch had diverged from release/v1.1 in production (conflicting V8, missing V9–V11 and checkout-abuse caps), plus an unauthenticated e-mail relay (H2), waitlist mail abuse, webhook memory DoS, IPv6 rate-limit bypass, staff lockout. ~4 minutes, 196k tokens. |
| 2026-11-11 | Read-only audit of the /buy gap fix (`--mode plan`, it also read files itself) | Gemini 3.8 Flash via `agy` | C | 5 findings: 1 real but minor (style cleanup without `finally`), 4 false positives (data-stuck "missing" although verified present, mini ornament "never shown" although a media rule shows it, desktop editor bar, a pre-existing max-height). Use Gemini only as a secondary auditor; verify each claim. |
| 2026-11-11 | Read-only code review of the step-1 polish (Vibe, read tools only) | GLM-5.3 | A | 3 findings, all real and missed by Claude: staff HelpTip panel would sit inline (non-wrapping legend), preview side stayed pinned across Nein/Ja because the local state survived, and a regex lookbehind would break the chunk on Safari < 16.4. Could not read the scratchpad diff (sandbox), so it reviewed the files directly. GLM-5.3 stays the main code auditor for Claude-written code. |

| 2026-11-12 | Merge production v1.1 into backend-domain (backend/migrations, docs, services and mobile E2E split) | Codex session subagents | B | Implementations integrated; backend 131 green with startup Byte Buddy agent, frontend tsc/lint and 61 Node green. Old optional-name/JSON/header/test seams corrected. Worktree resolved; index staging blocked by sandbox. No independent cross-LLM audit or browser verification claimed. |

| 2026-11-12 | Security implementation: M3/M4/L4 and rate-limit tests | Codex session subagent (inherited model) | A | IPv6 prefix and Track enumeration regressions reproduced before fixes; duration/CAS cleanup, account+client login failures and global pre-lookup Track gate implemented. Focused tests passed; parent verified the full suite (see security fix report). This is implementation, not cross-family audit. |
| 2026-11-12 | Read-only security cross-review attempt | GLM-5.3 via Vibe | — | Blocked before review: app-server initialization closed. No findings or approval produced. |
| 2026-11-12 | Read-only security cross-review fallback (diff supplied, no tools requested) | Gemini 3.8 Flash via Antigravity | — | Blocked before review: localhost bind denied by sandbox; log/crash writes also denied. No findings or approval produced. |

| 2026-11-12 | Read-only security audit of the fixes (rerun launched directly in background) | GLM-5.3 via Vibe | A | All fixes verified by reading; 2 real lows (6×10 MB photos exceed 60 MiB request cap; no global cap on public metrics) fixed by Opus. First run produced nothing because it was launched with `&` + pgrep wait. |
| 2026-11-12 | Post-merge E2E repair (install WebKit, fix stale specs, regenerate snapshots) | Opus subagent | A | Found a real bug (TrackDialog host attached to the loading screen); 715 passed / 2 skipped. |

## Routing changes

| Date | Change | Reason |
|---|---|---|
| 2026-11-11 | Fable 5.2 only as a last resort; visual audits and test fixing go to Opus subagents, code to Codex sol (credits back after 19:53) | Owner's decision; Fable also hit its 5-hour limit mid-audit |
| 2026-11-11 | Gemini via agy: no headless implementation (permission prompts cannot be answered and full auto-approve is blocked). Use it as a read-only auditor with the diff pasted into the prompt and `--mode plan` | Two runs with zero edits; the pasted-diff audit worked |
| 2026-11-11 | Opus works as project manager and delegates by default. Gemini 3.8 Flash (agy) joins as implementer/auditor; Fable 5.2 for heavy load until 2026-11-14; Codex only when the smoke test shows credits | Owner's decision; Codex hit the ChatGPT limit |
| 2026-11-06 | Initial table; astra moved to medium for complex work | Owner's decision |
| 2026-11-06 | Mistral's own models removed from routing | Owner: not good enough |
| 2026-11-06 | GLM-5.3, GLM-5.3 Flash and DeepSeek V4.1 Flash added via Vibe | Included in the owner's Mistral plan |
| 2026-11-08 | GLM via Vibe implementation briefs must not rely on running node/npm: Claude builds and tests afterwards | Vibe denied every node/npm call in accept-edits mode |
| 2026-11-09 | Astra model id is `gpt-6-astra` (no `.1`); `gpt-6.1-astra` is rejected on the ChatGPT plan. For browser-engine questions, ask for source-level evidence (WebKit/Chromium code), not blog workarounds | Astra beat sol on the Safari diagnosis by reading WebKit source |

## Setup status

- Claude Code: ✅ (Fable 5.2 available until 2026-11-14)
- Antigravity CLI `agy`: ✅ `~/.local/bin/agy`, signed in; models Gemini 3.8 Flash (high/medium/low), also Claude Sonnet/Opus 4.6 and GPT-OSS 120B (do not use those for cross-LLM audits of Claude/GPT code).
- Codex CLI: ✅
- Mistral Vibe 3.1: ✅ `~/.local/bin/vibe`, signed in (key in the macOS Keychain). Plan: Education, €127.50/month Vibe Code + €12.75/month API, resets on the 1st; pay-as-you-go **off**.
- GLM-5.3 and GLM-5.3 Flash: ✅ built into Vibe.
- DeepSeek V4.1 Flash: ✅ added by hand to `~/.vibe/config.toml` (`[models.deepseek-v4-1-flash]`, API id `deepseek-v4-1-flash-1017`, public preview). Unknown yet whether it draws from the Vibe or the API allowance — check admin.mistral.ai/subscription after real use.
| 2026-11-12 | Staff price editor UI + mock/HTTP contract (v3.1) | Claude Haiku subagent | A | Clean, in scope; reused the existing euro parser; flagged a lint error caused by another agent. Owner asked to use OpenAI models less this session. |
| 2026-11-12 | Painting days month picker (new component + page) | Claude Haiku subagent | A | Good structure (pure monthGrid helper + 6 tests), listed the E2E specs to update; no visual check (none requested). |
| 2026-11-12 | Full flow + staff UX audit (5 /buy combos, /form, every staff screen, 213 captures) | Claude Opus subagent | A | 1 P0 + 24 P1 + 30 P2, measured; froze a copy of the commit when other agents broke Vite mid-run. Report only via hand-back (subagent Write refused). |
| 2026-11-12 | Staff Statistics page (charts, ranges, mock) + mobile redesign after owner feedback | Claude Opus subagent | B | First version overflowed tiles and was too long on phones (owner caught it); v2 with section filter and overflow assertions fixed it (Sales view 1.4 screens). |
| 2026-11-12 | Small staff P2 batch (8 items) | Claude Haiku subagent | B | 7/8 done; correctly stopped on the item that needed a DTO change; used a negative margin in the More menu (to review visually). |
| 2026-11-12 | Read-only audit of new backend (prices, stats, agenda fields) via Vibe | GLM-5.3 | A | First run 429 (no capacity); second run: 3 real P2 (era surcharge fallback, no price audit trail, V14 untested on PostgreSQL), no false positives. |
| 2026-11-12 | E2E repair after the v3.1 staff/public changes | Claude Opus subagent | A− | Fixed selectors/fixtures and 2 real product bugs (43 px calendar cells, stale editor after a retried save); left the 360×640 deliveries height and 4 snapshots to the PM, correctly. Long run (~60 min) partly due to external CPU load. |
| 2026-11-12 | Read-only cross-audit of the Claude-written v3.1 frontend | Codex gpt-6.1-sol (medium) | A | 4 real P2 (paid total shown as €0.00, stale painting-day editor on reselect, handover dialog still blocked Escape, mock 62 vs 63 dates), no false positives; all fixed. |
| 2026-11-12 | Debug CI-only (Linux WebKit) review-bar failure + flaky staff 401 test | Claude Opus subagent | A | Reproduced in a Linux Playwright container (skopeo when docker pull hung); real product bug (scroll lands 155 px short after a step change while scrolled down), 2-line fix; deflaked 401 test. ~29 min. |
| 2026-11-12 | Public forms: in-flow action bar + steady back-name typing (own worktree) | Claude Opus subagent | A | Found the real jump cause (content inserted above the field on the first letter: side toggle +66 px, tile label line change), removed usePublicActions, added a per-letter scroll test on 11 phones. ~30 min. 7 workers alongside another agent caused false timeouts. |
| 2026-11-12 | Track: remove address editor, add Instagram contact row (own worktree) | Claude Opus subagent | A | Clean removal incl. API contract/mock, shared InstagramLink component, new track.spec; flagged the now-unused backend endpoint instead of deleting it. ~22 min. |
