# Sprint 5 — audit fixes: API contract (2026-11-05)

Source: tasks/audit-final.md. Backend by Claude, frontend by Codex; each reviews the other. The mock implements the same contract.

## Errors
Every non-2xx body: `{ status, message, code?, field? }`.
- `code` (stable, for client-side localisation): `VALIDATION`, `NOT_FOUND`, `ORDER_NOT_FOUND`, `FORM_LOCKED`, `POSTAL_OUTSIDE_VIENNA`, `DELIVERY_DAY_INVALID`, `PICKUP_DAY_INVALID` (field `deliveryDate`), `PICKUP_TIME_INVALID` (field `pickupTime`), `DAY_FULL`, `RATE_LIMITED`, `STOCK_CHANGED`, `OUT_OF_STOCK`, `PHOTO_INVALID` (field `photos`), `PAYMENT_PENDING`, `SHOP_CLOSED`, `TOO_MANY_OPEN_CHECKOUTS`, `PAYMENT_PROVIDER`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `BAD_REQUEST`.
- `field` (for `VALIDATION`): the request property path, e.g. `items[0].petName`, `address.postalCode`, `customerName`.
- The frontend shows a localized text for known codes (DE/EN) next to the field when `field` is set, and falls back to `message`.

## Staff sale idempotency
- `POST /api/orders` accepts header `Idempotency-Key: <uuid>`. Repeating the same key returns the SAME order (200 instead of 201) and does not create or deduct anything again. The frontend generates one key per sale draft (kept until the sale succeeds) and also disables the button while sending.

## Staff sale delivery days
- A market pickup (`deliveryKind: 'market'`, from `POST /api/shop/pickup-days`) has no address and no fee; `deliveryDate` must be an offered stall day (400 `PICKUP_DAY_INVALID`) and `pickupTime` ('HH:mm') a half hour from opening until 30 minutes before closing (400 `PICKUP_TIME_INVALID`).
- A Vienna delivery (`deliveryKind: 'vienna'`) must be on Wed/Fri or the season end (24 Dec), not on a stall day, not after the season end → 400 `DELIVERY_DAY_INVALID`. The wizard should only offer those days.

## Customer form (`/api/forms/{token}`)
- GET view gains `needsAddress: boolean` (true when any item is a Vienna delivery), `address: Address | null` (current delivery address), `editable: boolean` (false once painting started or the order was handed over).
- POST payload gains optional `address: { line1, line2?, postalCode, city }`; required when `needsAddress` (400 `VALIDATION` field `address`), postal code 1010–1230 (400 `POSTAL_OUTSIDE_VIENNA` field `address.postalCode`).
- POST when not editable → 409 `FORM_LOCKED`.

## Stock
- `PATCH /api/inventory/{id}` body `{ quantity, expectedQuantity? }`. When `expectedQuantity` is given and differs from the stored quantity (a sale happened meanwhile) → 409 `STOCK_CHANGED` (the message names the current count); the UI reloads the list and asks again.

## Shop
- `POST /api/shop/checkout/{code}/abandon` with header `X-Form-Token` → 204. Used when the customer returns from Stripe with `?cancelled=CODE`: expires the Stripe session and releases the pending order (no-op if already paid or gone). The browser has the form token from checkout.
- Checkout refuses with 429 `TOO_MANY_OPEN_CHECKOUTS` when too many unpaid checkouts are open (global cap) and 409 `DAY_FULL` when the chosen day just filled up.

## Orders
- `OrderDto` gains `paymentReview: boolean` — true when Stripe reported a payment that does not match the order (amount/currency); staff must check it in Stripe. Such orders are no longer released automatically.
- Track `status` values unchanged (`preparing | ready | delivered`); `ready` must be shown as "ready for delivery/pickup", never "out for delivery".


## Task A extension — invoices and delivery window (2026-11-08)

- Additive `GET /api/shop/config`: `deliveryWindowStart` and `deliveryWindowEnd` (`HH:mm`, default `18:00`/`20:00`, Europe/Vienna).
- Track `when` and form `handoffs`: existing `kind: 'vienna'` now has decimal `fromHour` and new `toHour` (18/20 by default). All prior JSON fields remain; `untilHour` remains the market closing hour and is null for delivery. Market/unknown `toHour` is null.
- Existing paid/deposit and handover mutations now archive numbered invoice snapshots; mail is async after commit and disabled without SMTP. No request changes or invoice endpoints. See `contracts-and-dtos.md` for replacement numbers, idempotence and accounting retention.

## Pre-release security extension (2026-11-12)

- Public address PATCH and form POST require a confirmed web payment. For `Order.isUnconfirmedWeb()` (PENDING or REVIEW), both return **409 `PAYMENT_PENDING`** after ownership validation and before writes or notifications. Form GET returns `editable: false`. Staff QR orders remain editable under the existing rules.
- Abandon returns **204** for missing orders, absent/incorrect tokens, and authorized no-ops. Ownership is checked before taking the schedule lock. An authorized pending checkout still expires/releases as before.
- Waitlist mail budgets return **429 `RATE_LIMITED`**: 3/client/hour, 30 globally/hour, 200 globally/day. Confirmation resends also consume the budgets; confirmed addresses and repeats within the per-address cooldown consume no mail budget. Budget exhaustion is checked before address lookup for every request to avoid revealing subscribers; no-op requests remain 204 while shared budgets are available.
- Missing/blank Stripe signature remains **400** with no body; signature verification still precedes JSON parsing. Webhook input over 256 KiB returns **413 `TOO_LARGE`**, including streamed input without Content-Length. nginx imposes its smaller 64 KiB edge limit on this path, with its standard 413 response.
- Global Track missing-order budget: after 300 misses/hour, all further lookups return **429 `RATE_LIMITED`** before querying the order until the failure window expires. Only actual misses consume that global budget; blocking all lookups after exhaustion prevents distinguishing valid codes from invalid ones. IPv6 limiter clients share a /64.
- Existing checkout caps are unchanged: **429 `PENDING_CHECKOUT_LIMIT`** for two pending checkouts sharing normalized email or stored client IP hash; **429 `TOO_MANY_OPEN_CHECKOUTS`** for the global pending-order cap. No migration numbers or existing error codes are replaced.
