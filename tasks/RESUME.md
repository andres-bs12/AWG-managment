# Resume note — read this first if the session was cut (limits/crash)

Updated 2026-11-05 ~02:00. Owner is asleep and asked to keep going autonomously until EVERYTHING is done.
Reply to the owner in Latin American Spanish; code/comments in English. Branch feat/backend-domain, PR #2
(https://github.com/andres-bs12/AWG-managment/pull/2). Never audit with the same LLM that wrote the code
(Claude ↔ Codex). Codex: `codex exec -m gpt-6.1-terra -c model_reasoning_effort="high" -s <mode> -o <out> "<prompt>" < /dev/null`
and check the log shows `session id` within a minute.

## Done (committed + pushed unless noted)
Goals 1–5 of plan /Users/andresbejarano/.claude/plans/reflective-giggling-kernighan.md: /buy shop, review fixes,
Flyway, Docker (verified), password change + cancel order (backend+frontend), lazy routes, legal placeholders.

## Sprint 4 (owner answers in chat 2026-11-05; spec in docs/sprint4-contract.md)
- Backend (Claude) — DONE locally, NOT committed yet, 49 tests green: inventory API, painting days (open switch,
  default max 2/day, every weekday), season end 2026-12-24 + waitlist, deposit amountPaid, AWG+6 codes, V2 migration.
- Frontend (Codex run, scratchpad codex-s4-brief.md / codex-s4-result.md): stock page, painting days, deposit amount,
  Santa-left + waitlist, code format, cancel modal. Check result, build/lint, browser test, commit.
- TODO e-mail notifications (owner + customer on every movement; Spring Mail, disabled without MAIL_HOST; never claim
  sent). TODO legal base texts (DE/EN drafts from the app's features — artwithgab.com does not resolve; placeholders
  for name/address/UID). TODO Stripe kit for the owner (docs/stripe-setup.md step by step + Stripe CLI test script).
- TODO update tasks/preguntas-pendientes.md with the owner's answers; docs; AGENTS.md.

## Final phase (owner request)
Dual audit UI, UX, Security: write one specialized prompt per topic; BOTH Codex and Claude run each (test
everything possible, browser at http://localhost:5174, backend `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`
with SHOP_ENABLED=true dummy Stripe keys). Merge into a general report (tasks/audit-final.md), plan fixes, fix,
retest, commit, push, Spanish summary to the owner.
