# RESUME — autonomous work while the owner is away (2026-11-05)

Read AGENTS.md, docs/design-system.md and memory rules first. The owner wants a **perfect UX** on `/buy` (online shop, all devices) and `/form/:token` (QR flow at the stall: phones + iPad Air 11" 820×1180), then staff, then security. They will review everything by eye.

## Status 17:40 (Claude)

- Commit `0a891f5`: Codex's SEC-F work (form token expiry, HTTP-only production build, CORS `Idempotency-Key`), reviewed and e2e-validated by Claude.
- Staff UX t12, implemented by Claude (not committed until the full e2e passes):
  - sale P0-1 and P1-1…7: mock finished items; 56px large buttons via the root-cause fix of the `global.css` `:is()` specificity; Today-full hint; QR again; explicit leave dialog; handover dialog defaults; quiet Cancel; pending web orders.
  - agenda/ops P1-1/2/3/4/5/8/10, plus a partial P1-6 (compact short blocks) and a partial P1-7 (focused error by Save).
  - backend: Vienna `methodLabel` carries the date.
- Codex is rate-limited until 19:21. After it resets, a **Codex review of t12** is required (cross-LLM rule). Then P1-9 (painting days) and the remaining P2s.

## Status 13:50 (Claude)

- **Codex is rate-limited until 16:03.** The Codex runners (runner8/9/10) were stopped. Claude implemented task 9 itself:
  - market pickup frontend;
  - one-shortcut delivery calendar with a "Dein Termin" card;
  - PLZ/Ort alignment;
  - sticky bar spanning the card that merges at the end (`data-stuck`);
  - one Edit per review card (/buy and /form);
  - new spec `e2e/pickup.spec.ts`.
- **Next:** task 10 items 2–8 (Claude or Codex after 16:03), then the parallel UX review, staff (t11), and security (rerun `sec1.txt` with Codex once its limit resets).
- **Reviewer rule:** Claude wrote t9, so Codex must review it.
- **Frontend security audit (Claude subagent):** `tasks/audit-results/security-frontend-claude-2026-11-05.md`.
  - Fixed by Claude:
    - L1: `?cancelled=` is only honoured for this browser's pending checkout.
    - L2: the checkout URL must be Stripe or same-origin.
    - L3: logout clears local state first.
    - L4: `.ics` text is escaped.
    - L6: nginx overwrites `X-Forwarded-For`.
    - The `/assets/` headers.
  - Still open:
    - M1: form tokens persisted in `localStorage` without expiry, also on the staff device.
    - L5: production builds must fail unless the data source is http.
    - L7: the Playwright upgrade.
  - The backend security audit is still to do: rerun `run7/sec1.txt` with Codex.

## Running infrastructure

Background Codex chain, started by the Claude session. Status log and prompts live in:

`/private/tmp/claude-501/-Users-andresbejarano--claude-spares-spare-CKGUvj/7c990aca-0c8a-4dff-b2b8-a1a64e025cda/scratchpad/run7/`

- **`status.log`** — one line per step; `ALL DONE n` marks the end of runner n.
- **Runners chained in order:**
  - runner7: `/form` unification (t8) + loop b → `ALL DONE 7`.
  - runner8: t9 (mobile delivery fixes + market pickup frontend) + loop c → `ALL DONE 8`.
  - runner9: t10 (QR form polish, iPad projects, stepper copy) + loop d → `ALL DONE 9`.
- **Prompts:** `t*.txt`. **Codex summaries:** `t*.md`. **e2e output:** `e2e-*.txt`.
- If the scratchpad is gone or the chain stopped, re-run the remaining tasks with `codex exec -m gpt-6.1-sol -c model_reasoning_effort="high" -s workspace-write -o <out> "<prompt>" < /dev/null` from the repo root. Then run `cd frontend && npx playwright test` yourself, since Codex's sandbox cannot bind ports.

## Done

- **Committed:**
  - b591a79: premium `/buy`, metrics, e2e suite.
  - b33b479: design system applied to `/buy`, globe preview, item tabs, market pickup API with tests.
- **Backend market pickup:** `POST /api/shop/pickup-days`; checkout `deliveryKind=market` + `pickupTime`.

## Next (in order)

1. Wait for/finish runners 7–9 (above). When `ALL DONE 9` is in status.log and `npx playwright test` is green, commit and push.
2. **Parallel UX review** (reviewer LLM ≠ author: Codex wrote the frontend, so Claude agents review):
   - Separate parts: `/buy` screen 1, screen 2 (vienna + market pickup), screen 3 + thanks/cancel, `/form` all steps + Track redirect.
   - Viewports: 360, 390, iPad 820×1180 / 1180×820, 1280, 1440.
   - Check every text (DE + EN), every spacing against tokens, hierarchy, touch targets, a11y, and memory rules (`ui-polish-standards`).
   - Then fix the findings (Codex sol high) and run the e2e loop.
3. **Staff:**
   - Read `tasks/audit-results/staff-review-2026-11-05.md` (functional review by a Claude agent).
   - Fix the P0/P1 issues: backend by Claude, frontend by Codex.
   - Apply the design system to staff (tokens, components; IBM Plex density) and run a UX review of the staff flows.
4. **Security review:**
   - Codex read-only audit (high) plus a Claude `/security-review` of the branch.
   - Fix the findings, then retest: `./mvnw test`, `npm run build/lint`, `npx playwright test`.
5. Update AGENTS.md, tasks/todo.md and tasks/preguntas-pendientes.md, commit, push, and write a short Spanish summary for the owner. Delete this file and tasks/.agent-heartbeat when everything is done.

## Status ~17:00 (Claude)

**Committed:**
- 257571f: t9.
- 2b0876e: t10.
- b6412d2: t11 staff, backend security (@Version, V7).
- 166c9bf: review fixes.

**Running chain:**
- runner11: `secf.txt`, Codex frontend security (M1 tokens, L5 build) + e2e loop f → `ALL DONE 11`.
- runner12: `t12.txt`, staff UX fixes from the two Claude reviews in `tasks/audit-results/staff-ux-*.md` + loop g → `ALL DONE 12`.

**After ALL DONE 12:**
1. Run `npx playwright test`.
2. Review the regenerated snapshots by eye.
3. Commit and push.
4. Have Claude re-check the staff UX quickly in the browser.
5. Update AGENTS.md and todo.md.
6. Write the final summary.
