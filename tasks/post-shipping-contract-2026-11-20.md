# Post shipping — implementation contract (2026-11-20)

Design: `tasks/audit-results/post-shipping-design-2026-11-20.md` (read it; where it disagrees with this file, **this file wins**).
Branch/worktree: `feat/v3.1-post-shipping` in `../awg-post-shipping` (cut from `release/v3.1` 8578ac3; the main checkout has
uncommitted V15 edits and V16 that this branch does not contain — that is expected; our migration is **V17**).

## Owner decisions (final)
- "Lieferung in Wien" (Wed/Fri 18–20 hand delivery) is replaced by **Versand per Post** to **all of Austria**, fee **5,00 €** once per order.
- Fee and Post **collection weekdays** are editable on Stock (`price_setting`), defaults `awg.pricing.shipping=5.00`, `awg.post.collection-weekdays=TUESDAY,FRIDAY`. A collection weekday that is a holiday shifts to the **next working day** (Tue 8 Dec → Wed 9 Dec). Optional per-date override table `post_collection_day(date PK, open boolean)` (staff can add an extra or cancel a collection; empty by default, backend + staff endpoint only, no UI yet).
- Customer sees an **arrival range**, never an exact date. Range = collection day + `awg.post.transit-min-days` (2) .. `awg.post.transit-max-days` (3) **working days**.
- Working day = Mon–Fri and not an Austrian public holiday (computed for any year: 1 Jan, 6 Jan, Easter Monday, 1 May, Ascension, Whit Monday, Corpus Christi, 15 Aug, 26 Oct, 1 Nov, **8 Dec**, 25 Dec, 26 Dec).
- Collection day: a configured weekday, a working day, **strictly after** the last paint day of the order's custom ornaments (or after today for finished-only), and not before `awg.shop.deliveries-from`.
- **Last promised arrival: 23 Dec** (`awg.post.last-arrival`, default = season end − 1 day). If `arrivalTo` > last arrival → shipping not offered (web: card disabled with notice; staff: option disabled). Market pickup unaffected.
- Optional Post parcel number entered by staff; Track and the "shipped" e-mail link to `https://www.post.at/s/sendungsdetails?snr=<number>` (URL built by the server; number must match `^[A-Za-z0-9]{8,40}$`).
- **Finished pieces by Post** (owner, final): allowed **only when the same order also has a custom ornament shipped by Post** — one parcel, one fee. Finished-only orders never get Post. Rule behind `awg.post.finished-with-custom` (default `true`; `false` = custom only). The server rejects violations with 400 `SHIPPING_NEEDS_CUSTOM`.
- **Painting priority** (owner, final): Post/web paint sessions may use free slots on any painting day, market days included (wherever Gaby paints). Stall customers keep priority: staff get a "Make room" action on a Post/web session that moves it (under `ScheduleLock`) to the next valid slot strictly before its collection/handoff day, so the promised range holds. Backend: `POST /api/agenda/blocks/{itemId}/make-room` → moved block, or 409 `NO_SLOT_KEEPS_PROMISE` (never silently breaks a promise; staff then move it manually). Agenda/New sale UI for it = staff phase.
- Old `vienna` orders stay readable everywhere (legacy display "Lieferung in Wien" / "Vienna delivery"); new orders can't choose it.

## Data (V17__post_shipping.sql — already written, extend only if needed)
- `price_setting.shipping_fee NUMERIC(10,2)` and `price_setting.post_collection_days VARCHAR(80)` (nullable → defaults).
- `order_item.arrival_from DATE`, `order_item.arrival_to DATE`; `order_item.handoff_date` = **Post collection day** for post items.
- `orders.tracking_number VARCHAR(40)`.
- `DeliveryKind`: `MARKET("market")`, `DELIVERY("vienna")` legacy, new `POST("post")`. Check constraint updated in V17.
- Retention clears `tracking_number` together with the address/personal data.

## API (JSON field names are the contract between back and front)
- `DeliveryKind` JSON: `"market" | "post" | "vienna"` (vienna read-only legacy).
- `GET /api/shop/config` (`ShopConfigDto`): `deliveryFee` now **is the shipping fee**. Keep `deliveryWindowStart/End` (legacy display).
- **New** `POST /api/shop/shipping-quote` body `{ items: ShopItemShape[] }` → `{ available: boolean, collectionDate: string|null, arrivalFrom: string|null, arrivalTo: string|null }` (ISO dates). Uses existing painting capacity (`ShopService.plan` for each candidate collection day in order; first one that fits wins).
- **Removed**: `POST /api/shop/delivery-dates` and the front's `deliveryDates`.
- `POST /api/shop/checkout`: `deliveryKind` `"post"` (default when null) or `"market"`. For post: `address` required, postcode `^[1-9][0-9]{3}$` (error code `POSTAL_INVALID`, field `address.postalCode`), city required (free text); `deliveryDate` ignored (nullable now; still required for market); new `expectedArrivalTo` (ISO date, required for post). Server re-quotes under `ScheduleLock`: none → 409 `SHIPPING_UNAVAILABLE`; `arrivalTo` later than `expectedArrivalTo` → 409 `SHIPPING_WINDOW_CHANGED` (field `delivery`). Stripe line `"Versand per Post"`.
- `DeliveryDto` (item delivery): add `arrivalFrom`, `arrivalTo` (ISO date or null). Collection day is the item's existing handoff date field.
- `OrderDto`: add `trackingNumber` (string|null) and `trackingUrl` (string|null).
- Track (`TrackViewDto`/`TrackWhenDto`/`TrackItemDto`): post items expose kind `post`, `arrivalFrom`, `arrivalTo`, shipped = handed over, and `trackingUrl` (null when no number). No address shown.
- `PATCH`/`PUT` handover (`HandedOverRequest`): add optional `trackingNumber` (string|null) — stored on the order when present (blank clears).
- **New** staff endpoint `POST /api/shipping/window` body `{ readyOn: "YYYY-MM-DD" }` → same shape as shipping-quote (for New sale to show the range for a given last paint day).
- Staff sale (`CreateSaleItemRequest`): `deliveryKind: "post"` + `address` (AT postcode, city). Server computes collection day + arrival from the item's paint dates (finished: from today) and **ignores** client handoff dates for post; rejects with 400 `SHIPPING_UNAVAILABLE` when past the cut-off. One 5 € fee per order with ≥1 post item (`order.deliveryFee`, added to total).
- Prices: `PricesDto`/`UpdatePricesRequest` add `shippingFee` (0.00–99.99) and `postCollectionDays` (array of 1–5 distinct `"monday"`…`"friday"`).
- QR form (`/form/:token`): needs an address when any item is post; AT postcode rule; city editable.
- E-mails/invoice (German): fee line "Versand per Post", item line "Zustellung voraussichtlich 3.–4. Dezember 2026"; when all post items are handed over: "Deine Bestellung ist unterwegs" mail with the arrival range and, if present, the Post tracking link. Legacy vienna text unchanged for old orders.
- Agenda/Deliveries: post items group under their collection day, label "Post · Tue 1 Dec".

## Customer copy (German first; follow docs/reglas-aprendidas.md §1 — no filler, no promises)
- Method card: **Versand per Post** · "Zustellung in ganz Österreich" · +5,00 € / **Shipping by post** · "Delivery anywhere in Austria" · +5,00 €.
- Range: **Voraussichtliche Zustellung** "Do, 3. – Fr, 4. Dezember" / **Estimated delivery** "Thu 3 – Fri 4 December".
- Unavailable: "Vor Weihnachten ist kein Postversand mehr möglich." / "Post can no longer arrive before Christmas." (+ pickup stays selectable).
- Track: chip **Versendet** / **Shipped**; "Zustellung voraussichtlich 3.–4. Dezember"; link "Sendung verfolgen" / "Track parcel" only when `trackingUrl`.
- No `.ics` calendar button for post (range, not an appointment).

## Make room (owner, 2026-11-20 — generic, beyond Post; supersedes the Post-only make-room above)
- **Movable session** = a paint block whose item's handoff day (pickup day, Post collection day, legacy Vienna delivery day) is **after** the block's paint day. Same-day handovers are never movable. A move must land on a free slot (same capacity rules as `findFreeSlot`, so location/two-market rules apply) **strictly before the handoff day**, never in the past (≥ now, Europe/Vienna), never after handoff minus its buffer. Handoff, pickup time and arrival range never change.
- `POST /api/agenda/blocks/{itemId}/make-room` (staff, ScheduleLock) → 200 `{ moved: [Move] }` (one entry); 409 `SESSION_NOT_MOVABLE` (same-day handover / not a paint block); 409 `NO_SLOT_KEEPS_PROMISE`.
- `POST /api/agenda/make-room` (staff, ScheduleLock, `Idempotency-Key` header; replay returns the same response) body `{ date: "YYYY-MM-DD", minutes: number, marketDayId?: string }` → frees a contiguous slot of `minutes` on `date` within that day's painting hours (at the given stall day, else where Gaby paints). Picks the fewest moves, preferring sessions with the latest handoff. 200 `{ slot: { date, startHour, endHour }, moved: [Move] }` (`moved` may be empty if a slot was already free); 409 `NO_MOVABLE_SESSION` with `reason`: `SAME_DAY_ONLY` ("All of today's sessions are for pickups today, so none can be moved."), `NO_TARGET_SLOT` (movable sessions exist but none fits elsewhere before its handoff), `NOT_PAINTING_DAY`. All-or-nothing.
- `Move` = `{ itemId, orderCode, from: { date, startHour, endHour }, to: { date, startHour, endHour } }` (hours as decimal, like `HourSpanDto`).
