# Sprint 5 — audit fixes: API contract (2026-11-05)

Source: tasks/audit-final.md. Backend by Claude, frontend by Codex; each reviews the other. The mock implements the same contract.

## Errors
Every non-2xx body: `{ status, message, code?, field? }`.
- `code` (stable, for client-side localisation): `VALIDATION`, `NOT_FOUND`, `ORDER_NOT_FOUND`, `FORM_LOCKED`, `POSTAL_OUTSIDE_VIENNA`, `DELIVERY_DAY_INVALID`, `DAY_FULL`, `RATE_LIMITED`, `STOCK_CHANGED`, `OUT_OF_STOCK`, `PAYMENT_PENDING`, `SHOP_CLOSED`, `TOO_MANY_OPEN_CHECKOUTS`, `PAYMENT_PROVIDER`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `BAD_REQUEST`.
- `field` (for `VALIDATION`): the request property path, e.g. `items[0].petName`, `address.postalCode`, `customerName`.
- The frontend shows a localized text for known codes (DE/EN) next to the field when `field` is set, and falls back to `message`.

## Staff sale idempotency
- `POST /api/orders` accepts header `Idempotency-Key: <uuid>`. Repeating the same key returns the SAME order (200 instead of 201) and does not create or deduct anything again. The frontend generates one key per sale draft (kept until the sale succeeds) and also disables the button while sending.

## Staff sale delivery days
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
