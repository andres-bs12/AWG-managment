# Real tests in production — findings (2026-11-22)

Owner asked for real end-to-end tests on artwithgab.com: every order state, every customer and owner e-mail,
fake Post tracking number included. Test orders use the owner's own address and a "TEST correos (borrar)" market.
Every finding goes here and, when it is a code fix, onto branch `fix/qa-real-tests-2026-11-22`.

## Findings

| # | Area | Finding | Status |
|---|---|---|---|
| 1 | Ops · staff login | `deploy/reset-staff-password.sh` passed the bcrypt hash unquoted through ssh; the remote shell expanded `$2`, `$1`… and stored a broken hash (54 chars, `y2M…`). Login was impossible after every reset. | Fixed: arguments quoted with `printf %q`, checked against the server with a fake hash. Owner re-ran it and signed in. |
| 2 | New sale | On a day with only a home ("Casa") day and no open market, New sale sent the home day as `soldOnMarketDayId`; the backend accepts only open market stalls, so every sale failed with "Choose the market where this sale took place." | Fixed in `NewSalePage.tsx` (send only an open market day). Needs deploy. |
| 3 | Data · production | Production has only the market "Test 1" (6–16 Dec) and "Casa". The real markets of 25–29 Nov are not loaded yet. | Owner to confirm/enter. |
| 4 | Stripe · production | Production `.env` uses a test secret key (`sk_test…`): the public shop cannot take real payments. | Owner: switch to live keys + live webhook secret when ready. |
| 5 | Markets form | Stall number rejects non-numeric values ("T"); fine, but the error only appears after Save. | Minor. |
| 6 | Mail | Mail works (Brevo, sender `hello@artwithgab.com`). Owner notices go to `OWNER_EMAIL=artwithgab@gmail.com`, not to the owner's personal Gmail. | OK. Owner: decide whether to also copy the personal address. |
| 7 | Mail · log | A customer without e-mail yet (stall sale before the QR form) logs "E-mail not sent (mail not configured)". Misleading: mail is configured; there is just no recipient. | Fixed: separate "no recipient yet" log. |
| 8 | Mail · subjects | Status mails to customers (payment, ready, handed over, cancelled) reuse the owner's English subject: "ArtWithGab: All ornaments finished - CODE". Only the receipt and "unterwegs" have German customer subjects. | To fix in the new templates. |
| 9 | Mail · duplicates | One staff action sends two mails: a deposit sends the receipt **and** "Payment updated"; collecting the rest at handover sends the receipt **and** "handed over". The receipt sent at handover says "Übergeben: Nein". | To fix: one mail per event; receipt reflects the handover. |
| 10 | Mail · content | Inconsistent money format (`55.00 EUR` vs `55,00 EUR`), German+English stacked in status mails but German only in receipt/"unterwegs". "Ready" mail does not say where/when to pick up. No mail offers Instagram or e-mail contact. Plain text only. | To fix in the new templates. |
| 11 | Mail · stall customers | Stall customers get no confirmation when the order is created (no e-mail yet) nor when they submit the QR form (owner-only notice). Their first mail is the payment receipt. | Owner to decide: send a "we got your details" mail on form submit. |
| 12 | Order page | Colour row shows a red dot and "shiny" instead of "Red · Shiny". | Fixed: "Red · Shiny" (also in the cancel dialog). |
| 13 | New sale · Post | Staff New sale demands the full Post address, while the backend lets custom-only parcels take the address from the QR form. | Fixed (owner delegated, 2026-11-22): backend rule wins. If every Post item is custom the address is optional at the stall and the customer adds it in the QR form; a partly filled address is still validated. |
| 14 | Cancel dialog | "Reason (optional)" label and its field are misaligned and the field is tiny. | Fixed: shared Field, 3 rows. |
| 15 | Track page | Contact offers Instagram only; owner wants Instagram **and** e-mail always visible. | Fixed: second row "Or write to artwithgab@gmail.com" (mailto with the order code as subject). |
| 16 | Not tested live | Address change after the form, waitlist opt-in. Web payment tested 2026-11-22 (`AWG5CFZGE`, 4242): customer mail, owner copy, red dot and Mark reviewed all work. | Pending: the two left. |
| 17 | Mail · artwork | Gmail strips inline SVG, so the approved peaks, ornament icons and contact icons were missing. | Fixed: hosted PNGs in `frontend/public/mail/`. |
| 18 | Mail · Brevo | Gmail shows "Unsubscribe" next to the sender of an order mail; Brevo probably adds `List-Unsubscribe`. | Confirmed in the raw header: Brevo adds `List-Unsubscribe` (one-click) and also rewrites links and adds an open pixel. No SMTP header turns it off; only Brevo support on an Enterprise plan. Left as is; open/click tracking goes to the advisor question in `tasks/todo.md`. |
| 20 | Mail · sender | Inboxes showed the bare "hello@artwithgab.com". | Fixed: sent as "ArtWithGab <hello@…>". |
| 21 | Mail · owner | Owner notices were plain technical text. | Fixed: HTML with the same look, readable item lines, "Open in staff"; replies go to the customer. |
| 22 | Mail · form address | Changing the address in the QR form after sending it sent no confirmation (only the Track page did). | Fixed: a changed address sends the address mail. |
| 23 | Mail · duplicate | Collecting the rest at handover sent "Zahlung erhalten" and "Danke für deinen Besuch". | Fixed: only the thank-you mail, which shows the payment. |
| 24 | Order page · payment | After a deposit, "Correct payment" shows "Unpaid" selected and the "Mark deposit" button stays. | Fixed: a deposit order only offers "Mark paid"; the correction starts on the recorded state, amount and method, follows refreshes and is disabled until something changes. |
| 19 | Shop · price | The shop charges +€5.00 for the name on the back; docs say €12.99 by default. | Production `price_setting.name_extra = 5.00` was saved in Stock on 2026-11-21 (revision 3), so it is a staff choice; the 12,99 € in the docs is only the config fallback. Owner: change it in Stock if 5 € was not intended. |

## Test data

All test orders (the 7 of 2026-11-22 and 17 older ones), their customers, photos and receipts, and the markets "TEST correos (borrar)" and "Test 1" were deleted on 2026-11-22/23 after backups (`~/backups/pre-cleanup-*.sql.gz`, `uploads-pre-cleanup*.tgz`). Bases taken by the 2026-11-22 tests went back to stock; the older ones did not.
