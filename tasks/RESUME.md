# Resume note (for the next agent session)

Updated 2026-11-04. If a session ends mid-work, continue from here, then delete this file when done.

## Sprint 3b — web shop rework (owner request 2026-11-04)
- Only **custom** ornaments can be bought online (no `finished`).
- `/buy` must feel like a **shop**, not one long form: step-by-step (product with available colors and price → pet photos/name → delivery day → address/contact → review & pay).
- Show available colors (from inventory stock) in `/api/shop/config`.
- Audit UX with Codex (`codex exec -s read-only`) and fix findings.
- Fix Codex shop audit (scratchpad codex-audit-s3.md): release must check the Stripe session is really expired before deleting; delete orphan photo files when checkout fails.

## Then
- `./mvnw test`, `npm run build`, `npm run lint`, browser check on port 5174 (backend with SHOP_ENABLED=true, dummy Stripe key).
- Commit + push `feat/backend-domain`, open PR to `main`, report to owner in LatAm Spanish (questions in `tasks/preguntas-pendientes.md`).

## Status 2026-11-04 (evening)
- Backend part of 3b DONE (custom-only, colors in config, late-webhook check against Stripe, orphan photo cleanup, Stripe timeouts, webhook under schedule lock) — 44 tests green. Docs/todo/questions updated.
- Frontend wizard: Codex `gpt-6.1-terra` run in progress (brief in scratchpad codex-buy-brief.md). If it did not finish, rerun it with `-m gpt-6.1-terra -c model_reasoning_effort="high" -s workspace-write`.
- Owner is away and asked to finish everything autonomously: wizard → build/lint → browser check → Codex UX audit (terra, high) → fixes → commit/push → PR → code review of the PR → fix review findings.
