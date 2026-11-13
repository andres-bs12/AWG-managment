# Sprint 4 — API contract (2026-11-05)

Owner decisions (tasks/preguntas-pendientes.md, answers 2026-11-05) turned into API. Backend (Claude) and frontend (Codex) both implement this; the mock implements it too.

## Inventory (staff)
- `GET /api/inventory` → `InventoryItem[]` = `{ id, kind: 'custom' | 'finished', color: OrnamentColor | null, quantity }` (custom rows have a color; finished has color null).
- `PATCH /api/inventory/{id}` body `{ quantity }` (integer ≥ 0, ≤ 10000) → `InventoryItem`.
- Initial stock on a fresh database: 3 per custom color, 10 finished. Gaby changes it from the staff UI (custom = bases ready to paint; finished = ornaments painted in advance).

## Painting days (staff)
- Gaby paints every day (Mon–Sun) unless she closes that day. Default max **2** paintings (custom ornaments) per day.
- `GET /api/painting-days?from=YYYY-MM-DD&to=YYYY-MM-DD` → `PaintingDay[]` = `{ date, open, maxPaintings, booked }` for every date in range (max 62 days). `booked` = custom ornaments with painting on that date.
- `PATCH /api/painting-days/{date}` body `{ open: boolean, maxPaintings: number (0–10) }` → `PaintingDay`.
- Automatic planning (sale suggestions, move suggestions, web shop) only uses open days with `booked < maxPaintings`. Manual staff actions (explicit paint slot in a sale, moving a block) may exceed it on purpose; the API answers normally.

## Season / shop
- `GET /api/shop/config` gains `seasonEnd: 'YYYY-MM-DD'` (default 2026-12-24) and `seasonOver: boolean`.
- Delivery days: Wednesday/Friday (not stall Fridays) plus the season-end date itself (24 Dec, Thursday) as the last delivery; nothing after it.
- When `seasonOver` is true (or no delivery dates remain) the shop shows "Santa has left" and a waitlist form.
- `POST /api/shop/waitlist` body `{ email, locale: 'de' | 'en' }` → 204 (idempotent per email, rate limited). Public.

## Payments
- `PATCH /api/orders/{id}/payment-state` body `{ state, method?, amountPaid? }`.
  - `deposit` without `amountPaid` = 50 % of total; with `amountPaid` it must be > 0 and < total (a customer may leave more than half when there is no change).
  - `paid` → amountPaid = total; `unpaid` → 0.
- `Order` (OrderDto) gains `amountPaid: number`.

## Order codes
- New codes: `AWG` + 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (e.g. `AWGK7Q2MX`). Old `AWG` + 4 digits stay valid. Inputs accept both, case-insensitive: `^AWG[A-Z0-9]{4,6}$`.

## E-mail notifications (backend only)
- Owner and customer receive an e-mail on: web order paid, stall sale created (if the customer has an e-mail), payment state change, all ornaments finished, handed over, order cancelled, delivery address changed.
- Sent only when SMTP is configured (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `OWNER_EMAIL`); otherwise logged. The UI must never claim an e-mail was sent.
