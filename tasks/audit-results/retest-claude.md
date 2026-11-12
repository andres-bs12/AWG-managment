# Retest after audit fixes — Claude (live, HTTP mode)

Date: 2026-11-05. Frontend http://localhost:5174 (Vite, `VITE_DATA_SOURCE=http`), backend http://localhost:8080 (dev profile, dummy Stripe keys). Browser: built-in pane, own tab, plus curl and read-only `psql`.
Note: during the run `git status` showed `M frontend/src/pages/staff/OrderDetailPage.tsx`. That edit is not mine; another agent was working at the same time.

## Results

| Item | Result | Evidence |
|---|---|---|
| 1. UX-1 double submit (staff sale) | PASS | A JS triple `click()` on "Done" (finished, market pickup) and a double click on "Create order & show QR" (custom, Vienna) each sent exactly 1 `POST /api/orders` (201). Stock dropped by 1 each time (finished 198→197, red 200→199). Two concurrent curl POSTs with the same `Idempotency-Key` returned 201 and 200 with the same code AWG7DWRYX and a single deduction. |
| 1b. "Deliver now" on a non-market day | FAIL (new) | On Thu 5 Nov (Casa day), Finished + "Deliver now" returns 400 `BAD_REQUEST` "Choose a market day for the pickup". See bug H1. |
| 2. UX-2 Vienna form address | PASS | Delivery days offered: Fri 6/11, Wed 11, Fri 13, Wed 18, Fri 20, Wed 25/11, Wed 2/9/16/23 Dec and Thu 24 Dec. No stall Fridays (27/11, 4/11/18 Dec) appear. Form: an empty address shows "Dieses Feld wird gebraucht." next to the field; 4020 shows "Gib eine Wiener Postleitzahl ein (1010 bis 1230)." next to postal; 1070 is accepted. After submit, GET shows `address {Teststraße 1, 1070, Wien}`. Server: no address → 400 `VALIDATION` field `address`; 4020 → 400 `POSTAL_OUTSIDE_VIENNA` field `address.postalCode`. |
| 3. UX-3 photos | PARTIAL | Add, remove and counter work ("3 von 6" → "6 von 6" with the limit message "nur die noch verfügbaren Fotoplätze…" → "4 von 6" after removing two). A text file named `fake.jpg` is **accepted** on Form and on Buy with a broken preview (naturalWidth 0). On submit the user only sees the generic "Bitte überprüfe deine Angaben…". See M1. |
| 3b. UX-4 storage failure | PASS | With `sessionStorage.setItem` forced to throw on /buy, the flow keeps working and shows an alert. Copy is slightly off; see L4. |
| 4. UX-7/UX-9 /buy, Track | PASS | DE and EN steps work. Postal 4020 gives a field error in DE and EN (after re-validation; see L2). Checkout returns 502 `PAYMENT_PROVIDER`, the UI shows "Payment is temporarily unavailable. Please try again." and no order or stock is left behind (psql: no new row; stock unchanged). Track for an unknown code shows "Order not found. Check your code." / "Bestellung nicht gefunden. Bitte überprüfe deinen Code.". Ready status reads "Bereit zur Übergabe/Lieferung" / "Ready for pickup/delivery". |
| 5. UX-15 stock conflict | PASS | curl PATCH with `expectedQuantity: 500` → 409 `STOCK_CHANGED` "(now 198)". Changed the UI value to 197 without saving, then curl set it to 196. UI Save → "Stock changed. The latest quantity was loaded; review and save again." and the input shows 196. Normal save shows "Saved". Restored to 198. |
| 6. UI-4 responsive staff | PASS | At 360×740 and 768×1024, agenda, deliveries, inventory, markets, sales/new, order detail and password all have `scrollWidth == innerWidth` (agenda day chips scroll inside their own `overflow-x:auto` track). Navigation goes into a "Menu" button (aria-expanded) with 44 px items, and the menu closes after navigating. Viewport reset to desktop. |
| 7. UI-1 agenda contrast | FAIL | Not-started slot: `#6a7672` on `#e4e8e6` = **3.82:1** in list and calendar; calendar time range at opacity 0.82 = **2.86:1**. Delivered: `#9aa3a0` on `#eceeed` = **2.22:1**, calendar range **1.89:1**. Deliveries page minimum is 4.97:1 (OK). Tokens `--staff-slot-idle-ink` / `--staff-slot-done-ink` in `frontend/src/styles/tokens.css` are unchanged. |
| 7b. UI-2 control borders | PASS | Buy/Form `Field` input and textarea border 2 px `#5c6b80` on white = 5.43:1. Unselected colour chip border 5.43:1; selected chip border 14.88:1 plus tinted fill `#eef4f8`. |
| 8. Order detail | PASS | Both test orders cancelled from the UI (dialog "Keep order / Cancel order", then redirect to Agenda). No payment-review text on normal orders (`paymentReview:false`). Stock back to 200/199/198, `stored_photo` back to 1. |
| 9. Console errors | PASS (expected only) | Only "Failed to load resource" for responses I triggered on purpose: 409 (stock conflict), 400 (deliver-now bug, invalid photo submit), 502 (dummy Stripe), 404 (unknown track code). No JS exceptions. |
| 10. SEC | PARTIAL | `curl -I /api/orders` → 401 `application/json` `{"status":401,"message":"Sign in again.","code":"UNAUTHORIZED"}` with nosniff, DENY and CSP. No stack traces in any error body. However, several malformed requests return **500** (see M2). |

## New bugs

### High
- **H1 · "Deliver now" fails on any day without a market** — `/staff/sales/new`.
  - Steps: on a Casa or home day (e.g. Thu 5 Nov), add a finished product, choose Deliver now, Cash, Paid, then Done.
  - Result: 400 "Choose a market day for the pickup", and the sale cannot be recorded.
  - Cause: `toCreateItems` (`frontend/src/pages/staff/saleDraft.ts:196-209`) falls back to `today` (`days.find(d => d.isToday)` in `NewSalePage.tsx:146`), which is the **home** MarketDay. It sends that `marketDayId`, and `OrderService.java:166-168` rejects market-kind handoffs on a non-market day.
  - Fix: for `mode === 'now'`, send no `marketDayId`/`marketId` when today is not a `market` kind (the backend already treats a missing day as "handed over on the spot", `OrderService.java:171`). Alternatively, accept a home day for finished items in the backend.

### Medium
- **M1 · Invalid image accepted client-side; server error is generic** — `/form/:token` and `/buy`.
  - Steps: add a `.txt` renamed `.jpg`.
  - Result: it shows as a broken thumbnail and counts toward the limit. On submit the server returns 400 `BAD_REQUEST` "Photos must be JPEG, PNG, WebP or HEIC images." with no `field`, and the Form shows only "Bitte überprüfe deine Angaben…" without naming the photo.
  - Fix: in `api.uploads.toPhoto` (`frontend/src/api/http/services.ts`), decode the image (`createImageBitmap` / `img.decode()`) and reject with the localized "Das Foto konnte nicht gelesen werden." (already present in `FormPage.tsx:215`). In the backend `PhotoStorageService`/`FormService`, return a stable code (e.g. `PHOTO_INVALID`) with `field: items[i].photos`.
- **M2 · Unhandled Spring exceptions return 500 `code:"ERROR"`** — backend `GlobalExceptionHandler.java`.
  - `GET /api/orders` without `code` (missing param), `POST /api/orders` with `text/plain`, `POST /api/forms/{t}` and `POST /api/shop/checkout` with a JSON body (expects multipart) all return **500** "Something went wrong" and are logged as server errors.
  - Fix: map `MissingServletRequestParameterException` → 400, `HttpMediaTypeNotSupportedException` → 415, `MultipartException` → 400. The 405 response also uses `code:"ERROR"`, which is not in the contract list; use `BAD_REQUEST` or add `METHOD_NOT_ALLOWED`.
- **M3 · UI-1 not fixed** (see table): raise `--staff-slot-idle-ink` and `--staff-slot-done-ink` to at least 4.5:1 against their fills, and drop the 0.82 opacity on `.slotRange` (`AgendaPage.module.css`).

### Low
- **L1 · Stale error and wrong helper text in the sale wizard** — after the H1 error, switching to "Market day" keeps the "Choose a market day for the pickup" alert, and "Hand over at the stall now. No calendar and no customer form." stays visible. Clear the error when the mode changes and show helper text per mode (`NewSalePage.tsx`).
- **L2 · Field error does not re-localize** — an error shown in DE stays in German after switching to EN until the next validation (`BuyPage.tsx`). Store error codes, not text.
- **L3 · Accessible names "on"** — the "Add name" checkbox in the staff wizard and the colour radios and name checkbox on /buy step 1 are announced as "on" (read_page). Associate the label (`aria-labelledby` or wrap correctly). Form inputs with errors lack `aria-invalid` / `aria-describedby`.
- **L4 · Copy** — storage-failure message only mentions photos, but text is not saved either. Review row label is "Lieferadresse ändern" (an action) instead of "Lieferadresse". Agenda shows "1 pickups". Order detail offers "Change to unpaid" on an unpaid order. The cancel dialog for a paid order says nothing about returning the cash. "1 Items" step label still present (UI-8). At 360 px the "AWG" brand renders below the opened menu, and "Log out" is 32 px high.
- **L5 · Form tokens persist in localStorage** — `awg-form-token:<code>` entries stay in the staff browser indefinitely, including for cancelled orders (relevant to SEC-3). Remove the entry on cancel or handover, or expire it.

## Cleanup
- Orders created and cancelled: AWGZ8XWLZ (UI), AWG7DWRYX (curl), AWG7XYVT8 (UI). The failed checkout left no order.
- Stock restored: red 200, grey 199, finished 198 (same as at start).
- Pane: removed my buy/sale drafts from sessionStorage and the AWG7XYVT8 form token from localStorage. Viewport reset to desktop.
