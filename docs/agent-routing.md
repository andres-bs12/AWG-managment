# Agent routing — which model does what

**Purpose:** base document for splitting work across our subscriptions (Claude, ChatGPT/Codex, Mistral Education plan — used only for the GLM and DeepSeek models it hosts). It learns: after each delegated task, add a line to the results log and adjust the routing table when the evidence says so.

**Owner of this file:** the orchestrator (Claude Opus). Update it at the end of each sprint at the latest.

## Roles

| Role | Model / tool | Use for |
|---|---|---|
| Orchestrator / project manager | **Claude Opus** (Claude Code) | Owner (2026-11-11): act as project manager and delegate by default. Plans, splits work, delegates, merges results, decides. Does the hard parts itself: delicate backend, security, integration, browser/Playwright, computer use. Final word on every change. |
| Complex implementation (peer) | **Codex `gpt-6.1-astra`, effort medium** | Hard features or refactors when Opus is busy orchestrating. Expensive: only for genuinely complex work. |
| Standard implementation | **Codex `gpt-6.1-sol` / `gpt-6.2-sol` (on trial), medium / high** | Most features and fixes. High when the task spans several layers or files. |
| Easy / mechanical work | **GLM-5.3 Flash** or **DeepSeek V4.1 Flash** (via Vibe) | Renames, copy edits, small tests, boilerplate, docs touch-ups. Compare both in the log. |
| Medium work / third auditor | **GLM-5.3** (via Vibe) | Single-file features; independent read-only reviews (different family from Claude and GPT). |
| Images and visual review | **Codex `gpt-6.1-terra`** / **ChatGPT** | Image generation, reading screenshots, visual critique. |
| Auditor (non-Claude, non-GPT) | **Gemini 4 Neon** (`gemini-4-neon-high`) via `agy`, `--mode plan`, diff pasted | Read-only reviews of Claude or Codex code. Replaces GLM-5.3 as third auditor when Mistral ends (after Nov 2026). Quality on our code untested as of 2026-11-20: grade it. |
| Scoped implementation (non-Claude, non-GPT) | **Gemini 4 Hydrogen** / **Neon** via `agy`, default mode | Implementation now works headless (2026-11-20 smoke test). Grade on real tasks: Neon for harder fixes, Hydrogen for small scoped ones. |
| Extra Claude capacity | **Opus 5.5 / Sonnet 5.5** via `agy` | Draws on Google's quota, saving Claude Code tokens. Counts as Claude for the cross-LLM rule. |
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
# Gemini / Claude through Antigravity (`agy models` lists ids; updated 2026-11-20)
#   gemini-4-neon-{low,medium,high,xhigh}      planner / auditor
#   gemini-4-hydrogen-{low,medium,high,xhigh}  fast executor
#   gemini-4-argon-{low,medium,high}           older
#   gemini-pro-orchestrator-neon | gemini-pro-orchestrator-g1-pro   plan with Neon/Argon, execute with Hydrogen
#   claude-opus-5-5-{low,medium,high} | claude-sonnet-5-5-{low,medium,high}   Google quota, counts as Claude for cross-LLM
#   gemini-3.8-flash-{low,medium,high}         superseded
# Audit (read-only, diff pasted in the prompt; this is the proven pattern):
agy --model gemini-4-neon-high -p "<review brief with diff; never edit>" --print-timeout 1500s < /dev/null   # no --mode: plan mode denies commands
# Implementation: default mode (NO --mode flag) works headless since 2026-11-20; accept-edits auto-denies tools:
agy --model claude-opus-5-5-high -p "<task>" --print-timeout 0s < /dev/null
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

| 2026-11-20 | Market-stock frontend (multi-file) | Claude Opus 5.5 via `agy` (high) | F | 429 "Individual quota reached" after ~4 min, reset in ~5 h: the Claude model group in Antigravity has a small quota. Use agy's Claude models for short tasks only; reassigned to Codex gpt-6.2-sol. |

| 2026-11-20 | Market-stock backend: sales link, JPA entity, V15 FK, 15 new tests | Codex gpt-6.1-sol high | A (pending audit) | 186 tests green, ~9 min, 138k tokens. Claude verified on a PostgreSQL clone: V15 applies after V14, `validate` passes, real sale/double sale/not-painted/stats/cancel all correct. |
| 2026-11-20 | Read-only audit with `--mode plan` | Gemini 4 Neon via `agy` | F | Tried to run a command and plan mode auto-denied it: no output. Read-only audits now run in default mode with "never edit" in the brief. |

| 2026-11-20 | Read-only audit of the Codex market-stock backend (default mode, diff pasted) | Gemini 4 Neon via `agy` | A | 2 findings, both real after Claude's check: lazy proxy id read could load 5 MB photo blobs (stats/bundle/cancel), and inconsistent 400/409 order on stale sold pieces; confirmed the rest of the spec. No false positives. ~9 min; `-p` prints only at the end, so the panel shows no output while it works (normal). |
| 2026-11-20 | Market-stock frontend (picker, Stock, Stats, mock, 4 specs) | Codex gpt-6.2-sol high | pending E2E | build/lint/89 Node green, ~210k tokens, ~20 min. First real 6.2-sol task. |

| 2026-11-20 | 2 backend fixes from an audit (JPA read-only FK column + error-check order) with tests | Gemini 4 Hydrogen via `agy`, default mode | A | Correct, in scope, added a test that the proxy stays uninitialised; found the Byte Buddy agent by itself; 188 tests green, ~8 min. First real Hydrogen code task: good for small scoped backend fixes. |

| 2026-11-20 | iPad photo-first picker + photo on sale/summary/order cards (5 files + spec), ran Playwright itself and took iPad/phone screenshots | Gemini 4 Neon via `agy`, default mode | A | Did exactly what the owner asked; Claude reviewed the 6 captures: big recognisable photos, 3/5/2 columns, code + `Colour · S/M`, photo kept on the sale. agy CAN open ports (ran Playwright on 5251), unlike Codex. ~15 min. Strong at UI work too. |

| 2026-11-20 | Staff nav + agenda calendar-only + block drag + pet photos (front + agenda DTO) | Codex gpt-6.2-sol high | B | Built to brief, 221k tokens; E2E 191/192 on iPad/phone/desktop, but Neon's audit found real iPad touch bugs in the new drag (short move opens the order, Safari scroll steals the hold, no keyboard move) and an unbounded base64 photo cache. |
| 2026-11-20 | Read-only frontend audit (default mode, diff + files) | Gemini 4 Neon via `agy` | A- (pending fix verification) | 9 concrete findings incl. iPad Safari touch-action and pointer-capture details; quality comparable to Codex audits. |

| 2026-11-20 | Read-only design: two simultaneous markets (code places file:line, migration, questions) + stall noise/missing review | Gemini 4 Argon high via `agy` | A | Precise: found V1 already allows a MarketDay per market per date, the pickup market is lost on save, ~15 one-market-per-date assumptions with lines, 4 sharp owner questions. Stall review mostly useful; 1 item contradicted the owner (Pickups tab). Uses Argon's separate weekly quota (0 % before): good home for read-only design work. ~10 min. |

| 2026-11-20 | Nav 2 buttons + 6 audit fixes (LRU blob photo cache, dedupe, mock emit order, Stock refresh, header errors, mobile search close) | Gemini 4 Neon via `agy` | A- | All 8 items done, verified each finding as real, 191/194 (3 = other agent's area), screenshots. Gemini 4 5 h quota went 25 % → 52 % running two Neon tasks in parallel (~25 min each). |

| 2026-11-20 | Agenda round 2: capacity from hours (front+back, no migration), long-press move + keyboard move, titles, bigger photos, code+handoff on blocks, 3 audit fixes, 1 product bug behind a failing test | Gemini 4 Neon via `agy` | A | 190/190 E2E on iPad/phone/desktop, 190 backend; Claude's screenshot check matches the owner's asks. Left minor noise in the deliveries column (queued). |

| 2026-11-20 | Inline piece picker in New sale (remove dialog, specs, screenshots) | Gemini 4 Hydrogen via `agy` | A | Clean, in scope, ran Playwright itself (21/21) and took iPad captures; Claude's check matches the owner's ask. Hydrogen is reliable for scoped UI/backend tasks. |

| 2026-11-20 | Two markets part 1 (V16, ~15 one-market-per-date places, I'm-at stall, Agenda/Deliveries/Track/invoices/shop) | Codex gpt-6.2-sol high | B (pending fixes) | 194 Java tests green; V16 applied on a PostgreSQL clone (HOME-day pickups stay unmatched, by design). Neon found 2 P1 (painting hours from the lowest-UUID stall on overlap dates; edits/deletes strand bookings) + fail-open web pickup. ChatGPT 5 h: 48 % → 71 %. |
| 2026-11-20 | Read-only audit of two-markets backend | Gemini 4 Neon medium via `agy` | A (pending fix verification) | 5 concrete findings with scenarios; listed what it verified clean. Medium effort was enough. |
| 2026-11-20 | Agy start failure | Gemini 4 Hydrogen | — | `failed to start conversation: backend returned an empty conversation id` (exit 0, nothing done); transient, relaunch worked. The wrapper should classify this as failed. |

## Routing changes

| Date | Change | Reason |
|---|---|---|
| 2026-11-20 | Why Google runs failed, and the fix: (1) `--mode plan` and `--mode accept-edits` auto-deny every shell command headless unless `permissions.allow` has a `command(...)` rule — that caused the Hydrogen, 3.8 Flash and Neon failures; (2) Opus/Sonnet in agy hit the small Claude-group quota (429). **Default mode (no `--mode`) lets Gemini 4 Hydrogen and Neon run commands and edit headless**: both fixed a failing test file end to end. Use default mode for implementation and audits (audits say "never edit" in the brief) | Owner wants Google to write code too |
| 2026-11-20 | New Codex models `gpt-6.2-sol` and `gpt-6.2-astra` answer on the ChatGPT plan (`gpt-6.2-terra` is rejected). Trial plan: 6.2-sol for audits and standard implementation next to 6.1-sol (compare in the log); 6.2-astra only for genuinely hard problems. Google models get graded task by task: Gemini 4 Neon = auditor, Hydrogen = small scoped implementation, Opus 5.5 via agy = multi-file implementation | Owner: try the new models and learn what each does well |
| 2026-11-20 | `agy` can implement headless in the **default mode** (no `--mode`): smoke test ran `ls`, `node`, `./mvnw` and wrote files in the repo. `--mode accept-edits` was the blocker; `--mode auto` is not available on this account. Claude Opus subagents (Claude quota) are replaced by Opus 5.5 / Gemini via `agy` (Google quota) for implementation; Claude Code stays orchestrator and Claude auditor | Owner: save Claude tokens, Claude only reviews |
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
- Antigravity CLI `agy`: ✅ `~/.local/bin/agy`, signed in. **Upgraded plan on 2026-11-20.** Models: Gemini 4 Neon (low/medium/high/xhigh; planner/auditor, launched 2026-11-18), Gemini 4 Hydrogen (fast executor), Gemini 4 Argon (older), Orchestrator (Neon) and (Argon) (plan with Neon/Argon, execute with Hydrogen), Gemini 3.8 Flash, **Claude Opus 5.5 and Sonnet 5.5 (low/medium/high)** and GPT-OSS 120B. All answered a headless smoke test on 2026-11-20. Claude models via `agy` use Google's quota (saves Claude Code tokens) but still count as Claude for the cross-LLM rule. Quality of Neon/Hydrogen on our code is **untested**: grade them in the log. Whether Hydrogen can edit headless (shell permission block seen with 3.8 Flash) is **untested**.
- **Budget goal (2026-11-20):** spread work across Claude, ChatGPT/Codex (Gaby also uses ChatGPT, so likely a shared quota) and Google so none runs out; keep quality. **Mistral/Vibe (GLM, DeepSeek) ends after November 2026**: from December drop it from the table and give its auditor role to a Gemini 4 model.
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
| 2026-11-13 | Fix full-suite public-mobile failures on Linux CI (own worktree, Docker) | Claude Opus subagent | A− | 3 test-only root causes (Linux WebKit isMobile stale scroll offset, Chromium 0.4 px overhang, taps during editor slide-in); 150/150 in the Linux container. Cut by the 5-hour limit once and resumed by message; ~63 min total. |
| 2026-11-16 | Read-only frontend audit: dead code + security | Codex gpt-6.1-sol (medium) | A | 8 findings, all real: form drafts left on the shared iPad (P2), 3 unreachable components, template leftovers, dead helpers and i18n keys, duplicate multipart builder. 98k tokens. |
| 2026-11-16 | Read-only backend audit: security + dead code (Vibe) | GLM-5.3 Flash | B | `glm-5-3` alias no longer exists in Vibe (only the Flash model). 3 P3 security notes (1 applied, 2 by design) and 7 dead-code items: 5 real, 2 kept because tests use them. Could not grep (shell denied), read files instead. |
| 2026-11-16 | Full audit lead: backend/deploy/live-site security review, verification of both audits, clean-up, SEO base | Claude Fable 5.2 (owner-requested) | — | Report in `tasks/audit-results/full-audit-2026-11-16.md`. |

## Agent panel (built 2026-11-20)

A narrow window the owner keeps at the right edge of the screen: model, short title, state, elapsed time; filters Trabajando / Terminados / Todos; click a row for the last 12 log lines.

- Launch every delegated CLI through the wrapper: `node scripts/agents/agent-run.mjs run --name <short> --model "<Model name>" --title "<what it does, Spanish, short>" -- <cli> <args>` (in the background so the chat is not blocked). It records `.agents/runs/<id>/{status.json,log.txt}` (including the run's `cwd`), closes stdin, and classifies the end: `done`, `failed` (also when a CLI exits 0 but did nothing, e.g. agy "no output produced / auto-denied") or `limit` (usage-limit text, with the retry time).
- Claude Code subagents (Agent tool) are registered by hand: `id=$(node scripts/agents/agent-run.mjs start --name <n> --model "Claude Opus" --title "...")`, optional `ping $id --note "..."`, then `finish $id --state done|failed|limit --note "..."` when the result returns.
- `scripts/agents/open-panel.sh` starts the server (`dashboard-server.mjs`, 127.0.0.1:4747) and opens the window only if it is not already open. The SessionStart hook in `.claude/settings.json` runs it; the orchestrator runs it again before delegating the first task of a session.
- **"Actualizar uso" button:** `POST /api/usage/refresh` (header `X-Agents-Action: refresh-usage`) re-reads Codex and Antigravity at once and Claude's file; the bars also refresh by themselves every 30 s. Claude's numbers come from `scripts/agents/statusline.mjs`, wired as `statusLine` in the git-ignored `.claude/settings.local.json`: Claude Code feeds it a JSON blob after each message and it records `rate_limits` when present (free, no tokens). **Unverified until a real blob arrives**: check `~/.awg-agents/statusline-last.json` for a `rate_limits` key; if missing, fall back to the manual command below.
- **Usage bars (5 h and weekly):** ChatGPT/Codex is read live from the newest `~/.codex/sessions/**/*.jsonl` (`rate_limits`; only as fresh as Codex's last session). Claude's usage can only be read by the orchestrator (MCP `get_usage`), so refresh it with `node scripts/agents/agent-run.mjs usage claude --five <pct> --five-reset <ISO> --week <pct> --week-reset <ISO>` at the start of a session and before big delegations; the panel says "dato de hace N min" when older than 30 min. Google/Antigravity is read live from its local language server (`GetUserStatus` on 127.0.0.1, port and local token from `~/.gemini/antigravity/daemon/hub_*.json`; quota per model group with remaining fraction and reset time), so it needs Antigravity open. Bars turn amber at 70 % and red at 90 %.
- **Clear finished:** the "Limpiar terminados" button (with an inline confirm) calls `POST /api/clear-finished`, which deletes the run folders of every finished run (done, failed, limit) and never touches working ones. The call needs the `X-Agents-Action: clear-finished` header and the localhost Host check, so no other web page can trigger it.
- `stalled` = no output and no git file change in the run's `cwd` for 5 min (a guess, not an error). For running runs with a `cwd` inside a git repo, `dashboard-server.mjs` inspects `git status --porcelain -uall` (cached 15 s per run, capped at 400 files, symlinks skipped, ignoring `node_modules`, `target`, `test-results`, `playwright-report`, `.agents`) and exposes `cwd` and `lastFileChange: { path, at }`. The panel shows `"Último cambio: <file> · <rel>"` (or `"Último cambio en el repo: …"` when multiple running runs share `cwd`). Logs live in `.agents/` (gitignored).
- Never `pkill -f` a script name while agents run: the name also appears in the agents' own command lines (this killed a Codex run on 2026-11-20).

| 2026-11-20 | Dashboard page (single HTML file) | Gemini 4 Hydrogen via `agy`, accept-edits | F | Exit code 0 but **no file written**: every tool call auto-denied in headless mode, same block as 3.8 Flash. The wrapper first reported it as done (fixed: exit 0 + "no output produced/auto-denied" now = failed). |
| 2026-11-20 | Same page, `--mode plan`, "reply with the whole file in one code block" | Gemini 4 Hydrogen via `agy` | A- | 1174 lines, correct API use, clean UI at 360 px (states, filters, counts, tab title), verified in the browser. Workaround for no headless edits: ask for the file as text and save it yourself. |
| 2026-11-20 | Panel server (zero-dep Node, endpoints, Host check) | Codex gpt-6.1-sol medium | B+ | Complete and correct on the first try (endpoints, 403 on bad Host, 400 on bad id verified by Claude); could not bind a port in its sandbox so it did not curl-test. Run died by SIGTERM from Claude's own `pkill`. |
| 2026-11-20 | Read-only audit of the panel wrapper + server (code pasted, `--mode plan`) | Gemini 4 Neon via `agy` | A | 8 findings, all real and concrete (id collisions, status.json race, `--key=value` silently marking failed runs done, false failed/limit classification, symlink/FIFO read in the server, EMFILE, truncated logs); its own report triggered finding #5 live. All fixed by Claude and re-tested. Neon is a strong auditor: use it for Claude/Codex code. |

| 2026-11-20 | Gemini 4 Argon (agy) | Agenda: Gaby away, gear grid, deliveries column | Code and screenshots done; hit the **weekly individual quota** (429, reset in ~162 h) while running its last Playwright pass. Argon's weekly pool went 7 % → 100 % in one day of design + 3 tasks: use Argon sparingly (designs/reviews), not for long Playwright loops. Grade B+ (good UI fixes; missed resolved-market label in the gear and inconsistent counts). |
| 2026-11-20 | Gemini 4 Hydrogen (agy) | New sale corner cases (10 rules) | 9 fixed + 1 OK; pure rules in lib/newSaleRules.ts, 5 Node + 24 E2E new; backend 207, Node 96 green. Grade A. |
