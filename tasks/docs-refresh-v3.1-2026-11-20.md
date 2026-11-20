# Docs refresh after the v3.1.0 deploy (2026-11-20)

Goal: anyone (agent or person) who changes v3.1 can trust the docs. Update docs to the real state of the code
on `release/v3.1` (= `main` = production, commit 389a1b3 + f455a37). Read the code to confirm every statement;
remove or mark as historical anything no longer true. Keep each file's language (AGENTS.md and most docs are
Spanish; code identifiers English). Concise: no conversation transcripts, no filler.

## Facts to reflect (verify in code)
- v3.1.0 deployed 2026-11-20 (tag `v3.1.0`), migrations V14–V17 applied in production; backup
  `~/backups/pre-v3.1-20261120T2038.sql.gz`. v3.0.2 is no longer production.
- Migrations: V15 numbered market stock (+ `order_item.market_ornament_id`), V16 `order_item.handoff_day_id` +
  painting_day "paints at" market, V17 Post shipping (V18 merged into V17). List V1..V17 where migrations are listed.
- Numbered market stock sold only through New sale (inline photo-first picker, Wine colour, Champagne = Beige,
  5 MB photos, cancel returns the piece to painted, Statistics "Non-personalised sold"). Error codes
  MARKET_STOCK_SOLD / NOT_READY / SELL_IN_SALE / CHANGED.
- Two simultaneous markets (25–29 Nov): per-device "I'm at" (`awg-active-market-id`), persisted handoff market,
  deterministic painting market (PaintingDay paints-at → primary → earliest stall), `SHOP_PRIMARY_PICKUP_MARKET_ID`.
- Gaby-location rule: same-day paint + market pickup only where Gaby paints (`PAINT_NOT_AT_THIS_MARKET`);
  suggestions skip it; changing paints-at with affected pickups → 409.
- Ready before the session ends frees the rest of the slot.
- Staff iPad: nav New sale + More (Needs attention with red dot, Deliveries in More), header search, Agenda
  calendar-only (long-press move, gear edits hours, capacity from hours, Gaby-away card, market icon per day,
  neutral blocks with status tags + customer name, painted trace, now-line above blocks), New sale big empty
  choices, Back with discard dialog, 1-2-3 stepper, 10 corner-case rules (`lib/newSaleRules.ts`), Sales with
  selling market.
- **Vienna hand delivery replaced by Österreichische Post shipping to all of Austria**, +5 € (price setting),
  Tue/Fri collection (holiday → next working day), +2..3 working days range, last arrival 23 Dec,
  `awg.post.paint-from=2026-11-25`, `collection-from` empty, finished pieces only together with a custom Post
  item (`awg.post.finished-with-custom`), optional tracking number linking to post.at, staff Ship list,
  make-room endpoints (`POST /api/agenda/blocks/{id}/make-room`, `POST /api/agenda/make-room`), Google Maps link
  for market pickup. Legacy `vienna` orders still readable. Read `tasks/post-shipping-contract-2026-11-20.md`.
- Legal texts final (no draft banner): private seller Impressum (Gabriella Vesovic, Jedleseer Straße 89/36/11,
  1210 Wien, artwithgab@gmail.com, +43 676 3347163), AWS/Cloudflare/Brevo as processors. Open for the advisor:
  Cloudflare DPF mention, 7-day damage report period (owner to confirm), Fri 27 Nov collection on a market day.
- Ops: `deploy/reset-staff-password.sh <email>` (owner runs it; bcrypt hash only sent); SSH access is the
  security group `awg-web` rule for port 22 (Claude updates it with the AWS CLI after `aws login`); deploy.sh
  needs a green e2e-full for the exact commit and a clean tree.
- Tests at release: backend 270, Node 106, e2e-full green in CI.
- Agent panel `scripts/agents/` (reset times, last file change, Pendiente queue: `agent-run.mjs pending add|done|list`).
- Process lessons are in `docs/agent-routing.md` → "v3.1 retrospective": copy the process rules (one
  Playwright run per machine, keep ≥15 GB free, geometry tests trusted only in CI, PM writes corner-case lists,
  briefs say "update the selectors you change") into `docs/reglas-aprendidas.md` §0.1 as numbered rules.

## Files
`AGENTS.md` (header, v3.1 section rewritten as "v3.1 (desplegada)", Backend actual, Tienda pública, Estado y
siguientes tareas; move superseded checkpoints under a short "Histórico" heading or trim them), `README.md`,
`docs/README.md`, `docs/frontend-api-swap.md` (new endpoints), `docs/deploy.md` (new env vars `SHOP_PRIMARY_PICKUP_MARKET_ID`,
`POST_*`/`awg.post.*`, password reset, SSH rule), `docs/reglas-aprendidas.md`, `awg-tracking/README.md`,
`tasks/todo.md` (only real open items: owner confirmations above, Stripe 4242/real purchase, SMTP check,
optional market address field, Cloudflare DPF, e-mail check after deploy).

Do not touch code. Do not commit. Report: file → what changed (one line each).
