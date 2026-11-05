# RESUME — autonomous work while the owner is away (2026-11-05)

Read AGENTS.md, docs/design-system.md and memory rules first. The owner wants a **perfect UX** on `/buy` (online shop, all devices) and `/form/:token` (QR flow at the stall: phones + iPad Air 11" 820×1180), then staff, then security. They will review everything by eye.

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
