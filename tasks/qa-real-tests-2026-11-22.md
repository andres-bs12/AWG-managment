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
| 7 | Mail · log | A customer without e-mail yet (stall sale before the QR form) logs "E-mail not sent (mail not configured)". Misleading: mail is configured; there is just no recipient. | To fix: separate log for "no recipient". |
| 8 | Mail · subjects | Status mails to customers (payment, ready, handed over, cancelled) reuse the owner's English subject: "ArtWithGab: All ornaments finished - CODE". Only the receipt and "unterwegs" have German customer subjects. | To fix in the new templates. |
| 9 | Mail · duplicates | One staff action sends two mails: a deposit sends the receipt **and** "Payment updated"; collecting the rest at handover sends the receipt **and** "handed over". The receipt sent at handover says "Übergeben: Nein". | To fix: one mail per event; receipt reflects the handover. |
| 10 | Mail · content | Inconsistent money format (`55.00 EUR` vs `55,00 EUR`), German+English stacked in status mails but German only in receipt/"unterwegs". "Ready" mail does not say where/when to pick up. No mail offers Instagram or e-mail contact. Plain text only. | To fix in the new templates. |
| 11 | Mail · stall customers | Stall customers get no confirmation when the order is created (no e-mail yet) nor when they submit the QR form (owner-only notice). Their first mail is the payment receipt. | Owner to decide: send a "we got your details" mail on form submit. |
| 12 | Order page | Colour row shows a red dot and "shiny" instead of "Red · Shiny". | To fix. |
| 13 | New sale · Post | Staff New sale demands the full Post address, while the backend lets custom-only parcels take the address from the QR form. | Owner to decide which rule wins. |
| 14 | Cancel dialog | "Reason (optional)" label and its field are misaligned and the field is tiny. | To fix. |
| 15 | Track page | Contact offers Instagram only; owner wants Instagram **and** e-mail always visible. | To fix. |
| 16 | Not tested live | Web payment (Stripe 4242: owner types the test card), address change after the form, waitlist opt-in. | Pending. |

## Test orders left in production

- `AWGMK7894` market pickup: deposit → ready → handed over with the rest in cash. 5 customer mails.
- `AWGWXP98K` Post: card paid → ready → handed to Post with fake tracking `RR123456785AT`. 4 customer mails.
- `AWGH7NAF6` cancelled. 1 customer mail.
- Market "TEST correos (borrar)" (22 Nov, cost 0).
