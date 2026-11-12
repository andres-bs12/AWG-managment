# Staff UX review: new sale, order detail, login (2026-11-05)

Reviewer: Claude (read-only, no app source changed). Data: mock dev server `http://localhost:5173` (`VITE_DATA_SOURCE=mock`), demo clock Sat 28 Nov 15:10, signed in as Gaby. Driver: headless Chromium (Playwright from `frontend/node_modules`), `hasTouch` on tablet/phone, DPR 1.
Viewports: iPad portrait 820×1180, iPad landscape 1180×820, phone 390×844, desktop 1440×900, plus 200 % root text size at 820×1180.

Screenshots and scripts are in `/private/tmp/claude-501/-Users-andresbejarano--claude-spares-spare-CKGUvj/7c990aca-0c8a-4dff-b2b8-a1a64e025cda/scratchpad/ux-staff-a/` (`shots/*.png`, `s*.mjs`). Below, `shots/` means that folder. Coordinates are CSS px.

Not covered: **network errors.** The mock runs in the page, so `page.route` has nothing to intercept, and the data source is fixed at build time (`api/client.ts`). Offline and HTTP error paths need an HTTP build. Attention-list entries were set up by editing the mock store inside the test browser only, by marking AWG0104 `pending` and AWG0103 `review`.

Severity: **P0** broken · **P1** hurts the stall workflow · **P2** polish.

---

## P0

### P0-1 · The simplest stall sale fails: one finished ornament, Deliver now, Paid in cash
- **Screen / viewport:** New sale → `+ Add finished product` → Continue → Deliver now · Paid · Cash → **Done**. Seen at 820×1180; the logic is the same at every size.
- **Evidence:** `shots/fin-3-done-single-portrait.png`. The order (AWGRKBP8A) **is created and marked paid**, then the page shows *"Finish all ornaments before marking handed over"* next to a **"Retry checks"** button. Tapping Done again repeats the same steps and fails the same way. A double tap gives the same result (`fin-3-done-portrait.png`, AWGEFB3FE). The worker cannot finish the sale. Paid orders are left behind as not handed over.
- **Cause:** `frontend/src/api/mock/store.ts:752` creates every item with `productionStatus: 'not_started'`. The backend creates finished items as `FINISHED` (`OrderService.java:165`). `setHandedOver` (`store.ts:899`) then rejects the handover. The HTTP build should work; the mock (the default source and the base of the staff E2E) does not.
- **Fix:** `store.ts:752` → `productionStatus: row.kind === 'finished' ? 'finished' : 'not_started'`. Also, in `NewSalePage.tsx` (error block, about line 610), show "Retry checks" only for planning errors (`phase === 'delivery' && !onlyFinished`). Here it means nothing.

## P1

### P1-1 · Every "large" staff primary button is 44 px, not 56 px
- **Evidence:** Measured heights: `Continue`, `Create order & show QR`, `Continue to payment`, `Mark paid · €…`, `Done`, `Enter` (login) are all **h=44** at all four viewports. Each is declared `size="lg"`.
- **Cause:** In `components/ui/StaffButton.module.css`, `.lg { min-height: var(--touch-lg) }` comes before `.staff { min-height: var(--size-control-staff) }`. Both have the same specificity, so `.staff` wins.
- **Fix:** add `.staff.lg { min-height: var(--touch-lg); }`. For gloves, consider `--size-control` (48 px) for all staff buttons rather than the 44 px floor.

### P1-2 · "Today" pickup is a dead end when today's painting is full, and nothing says why
- **Screen:** New sale step 2, 820×1180. **Evidence:** `shots/sale-4-planned-portrait.png`. The agenda reports "**6/2 paintings today**" for Sat 28 Nov. The sale still preselects **Today** and offers 16:00/17:00/18:00. Each hour returns "No safe paint time found. Choose another pickup day or review the agenda." That costs three taps per attempt with no reason given. The Market day picker shows "0/2 paintings booked" per day; Today shows nothing.
- **Fix:** `NewSalePage.tsx` `DeliveryCard`: show the same capacity hint on the Today option ("Today · 6/2 booked"). When today is over the limit, default `pickupWhen` to `another_day` and say "Today is full (6/2 paintings)." instead of the generic message.

### P1-3 · Once on Payment, the QR cannot be shown again
- **Screen:** New sale step 3 → `Continue to payment`. **Evidence:** `shots/sale-6-pay-portrait.png`. The only control in the action bar is `Mark paid`; the main area has no QR or link. A customer who has not scanned yet forces the worker to finish payment, open the order and scroll to the QR.
- **Fix:** in `NewSalePage.tsx` (payment `StaffActions`, about line 728), add a secondary `Show QR again` → `setPhase('qr')`. On the done screen, show the QR card again when the form is still pending.

### P1-4 · "Start over" after the order exists discards the screen silently
- **Evidence:** `s20.mjs`. Create the order (AWGBDPR6T) and tap `Start over` on the QR step. No dialog appears (neither a modal nor a native confirm), and the page resets to the empty item step. The order stays saved as **unpaid "Walk-in"** with a paint slot reserved (found by search: "AWGBDPR6T · Walk-in · unpaid · Sun, 29 Nov"). The QR is lost and so is the payment step.
- **Fix:** `NewSalePage.tsx:588`: render `Start over` only while `!order`. On the QR/payment steps, replace it with a `StaffDialog`: "AWG… stays saved and unpaid. Open it later from Search." It should be explicit and offer Open order / Start new sale.

### P1-5 · Balance-due handover dialog: the risky action is the only one that looks tappable
- **Screen:** Order AWG0107 (deposit, €56.48 due) → all ready → `Mark picked up`, 820×1180. **Evidence:** `shots/order107-handover-balance-portrait.png`. `Collection method` has **no default**, even though the order already records `cash`, so `Mark paid & hand over` is disabled (grey). The enabled, high-contrast button is **`Hand over with balance due`**. The dismiss button is labelled **`Keep order`**, copied from the cancel dialog, and is meaningless here. The sentence and the "Collection method" legend have about 6 px between them (516 → 522).
- **Fix:** in `components/staff/useHandover.tsx`, preselect `order.paymentMethod`. Make `Mark paid & hand over` the primary, turn `Hand over with balance due` into a ghost button, and rename the dismiss to `Not yet`.

### P1-6 · Order detail has three filled "primary" actions; Cancel order is the biggest
- **Evidence:** `shots/order107-portrait-1.png` and `-2.png`. `Open painting` (green fill), `Mark paid · €56.48` (green fill) and **`Cancel order` (solid red, 788×44, full width)** appear in one scroll. In a hurry, the red bar reads as the main action.
- **Fix:** In `OrderDetailPage.tsx` (aside, `variant="danger"`), make Cancel a secondary/ghost button with red text and natural width. Put it below a divider at the end; keep the red fill only inside `CancelOrderDialog`.

### P1-7 · A pending web order offers "Open delivery run", which leads to a list that hides it
- **Evidence:** AWG0104 set to `checkoutStatus: pending` (`shots/order-pending-portrait.png`). The header says **"Ready for delivery"** and shows `Open delivery run`. That opens `/staff/deliveries?day=2026-12-02&mode=route`, and **AWG0104 is not in it** (pending orders are filtered, as designed). AWG0103 in REVIEW still gets a green `Open painting`.
- **Fix:** In `OrderDetailPage.tsx`, when `order.checkoutStatus === 'pending' || order.paymentReview`, set `production` to "Waiting for online payment" / "Payment review". Hide the delivery-run and painting primaries, or show them as disabled with that reason.

## P2

**Money and date formats**
1. **Mixed money format on one screen.** The done card shows "AWG4B9GCT · **€ 49,99**" and "**€ 25,00** received" above a bar that says "€49.99" (`shots/sale-7-done-portrait.png`). The order hero shows "Balance due **€ 56,48**" while the payment panel says "€56.48" (`order107-portrait-0.png`). `formatEur` defaults to `'de'`. Fix: pass `'en'` in `NewSalePage.tsx` (`setPaidNote`, about lines 484 and 760) and in `OrderDetailPage.tsx` (overview balance). Better: make staff code call an `formatEurStaff` wrapper.
2. **Three date styles:** "Sat, 28 Nov" (sale), "Market 28/11 · 17:00" / "Paint Sat 28/11" / "Vienna Wed 02/12" (order page and item card). The order pickup also drops the market name (Rathausplatz). Fix: use `formatDateLabel` from `lib/time` in `handoffLabel` and `OrderItemCard`.
3. **The done-screen bar says "Total €49.99" after a €25.00 deposit.** At handover the figure that matters is the balance. Fix: on the done step, pass the remaining amount to `StaffActions` with the label "Balance due".

**New sale layout**
4. "Finished stock: 10 left" sits **0 px** above the item card (measured). It shows even when no finished item is in the cart. Fix: put a `--space-3` gap below it, and show it only next to "+ Add finished".
5. Item card header: `h3` is 24 px tall and `Remove` is 44 px, both top-aligned, so their centres are **10 px apart** (254 vs 264). Fix: `.cardHead { align-items: center }`.
6. The finish help renders as a **literal "(?)"** on its own row between Colour and Finish (44×44 at 33,446; `sale-2-items-portrait.png`). Fix: move the `HelpTip` into the Finish legend row and use the shared help glyph.
7. The **Painting plan** box uses muted grey for both its heading and its bold instruction, so it reads as disabled (contrast 5.43:1, which passes, but it looks inactive). It is inset to x=45 while the card content sits at x=33, and its link sits at x=49. It uses glyph icons "▦", "▼" and "✓". Fix: `NewSalePage.module.css` `.planTitle` → `--staff-ink`. Align `.slotBox` to the card's content edge, and use SVG chevron/check icons as the public calendar does.
8. **Docked action bar has 90° bottom corners** (`border-radius: 12px 12px 0 0`) and is inset 16 px from the screen edge, sitting on the full-bleed tab bar (`shots/zoom-bar-corner-portrait.png`). Fix: `StaffActions.module.css` `.bar[data-docked='true']`. Either make it full-bleed (`margin-inline:0; border-inline:0; border-radius:var(--radius-control) var(--radius-control) 0 0` across 0–820), or keep all four corners rounded with a `--space-2` gap above the tabs.
9. At ≥1024 px the in-flow action bar becomes a **white panel with zero padding**. Buttons touch its edges, and "Back to items" / "Copy link to send" float on a white strip (`sale-3-pickup-desktop.png`, `sale-5-qr-landscape.png`). Fix: in the `min-width:1024px` rule, also set `background: transparent`.
10. **Sticky hover on touch.** Secondary and ghost hover uses `--color-selection-hover`, which looks like a selection. After tapping a primary, the button that renders in the same place appears tinted: "Back to items" in `sale-3-pickup-portrait.png`, "Open order" in `sale-7-done-portrait.png`. iPad Safari keeps `:hover` after a tap. Fix: wrap the `:hover` rules in `StaffButton.module.css` and `SegmentedControl.module.css` in `@media (hover: hover)`.
11. The step labels "**1 Item** 2 Pickup 3 QR & payment" read as a quantity ("1 Item" appears with zero items, `sale-1-portrait.png`). On done, step 3 stays current. Fix: use "Items · Pickup · QR & payment" with `aria-current="step"`, and a done state.
12. **Empty state:** both "+ Add …" buttons are secondary and docked at the bottom, 790 px below "What are we selling?", above "Total €0.00" (`sale-1-portrait.png`). Fix: put the two add buttons in flow under the heading as large choice cards, and hide the total while there are no items.
13. With Delivery chosen but no day picked, the summary still says "Rathausplatz · Sat, 28 Nov" (`sale-vienna-portrait.png`). A finished item shows a red colour dot in the summary.
14. "Add name on ornament · €12.99 (text comes from the customer form)" is long. The aria-label differs from the visible label. Fix: use "Name on ornament · +€12.99", and put the form note in a hint.

**Order detail**
15. The payment panel has 24 px padding while the other panels have 16 px. Content sits at x=41 against x=33 (portrait) and x=627 against x=619 (landscape). The order page gutter is x=40 at 1180 px, but the sale page uses x=16. Fix: `OrderPaymentPanel.module.css` padding → `var(--space-4)`.
16. On a deposit order, "Record payment" is a radio group with a **single option** ("Paid"), shown as a full-width selected button (`order107-portrait-1.png`). "Method (optional)" contradicts the sale flow, where the method is required. "Record payment after checking…" sits about 8 px under the divider, and the legend follows with no gap. Fix: when only one option exists, drop the segmented control. Require a method, as the sale does.
17. `Correct payment` uses a native `window.confirm` (`OrderPaymentPanel.tsx:23`); everything else uses `StaffDialog`.
18. The confirmation notice ("Marked as paid.", "Order ready.") is sticky at the top of the scrollport. It overlaps the status buttons by about 15 px and never clears (`order107-paid-portrait.png`). It also appears far from the button that was tapped.
19. The REVIEW alert ("Stripe reported a payment that does not match…") uses the neutral grey inset note (`order-review-portrait.png`). Fix: use the warning tone.
20. Cancel dialog: "**1 ornaments** will be removed". The refund sentence shows even when "Received: €0.00" (`cancel-dialog-portrait.png`).
21. Dismiss labels are inconsistent: "Cancel / Keep working" (complete-order dialog), "Keep order" (balance dialog), "Keep working" (sale balance dialog). Use one verb: "Not yet".
22. After Escape closes the balance dialog, focus goes to `body` instead of `Mark picked up`. The Cancel dialog does restore focus correctly.
23. The "Balance due" amount link is **24 px** tall (558,371, 229×24), below the 44 px minimum.
24. Duplicated copy: "Tap to enlarge" under the QR plus "Tap the QR to show it to the customer." beside it. An item with no pet name shows "Custom ornament" above "Custom ornament · €62.98".

**Search and attention**
25. Rows show raw lowercase states ("unpaid", "paid"). "Waiting for online payment · Wed, 2 Dec" reads like a payment deadline; prefix the date with "Delivery" or "Pickup". Fix: `OrderLookupPage.tsx` uses a label map.
26. "Needs attention (0)" is a full outlined 179×44 button even at zero. Fix: render it quiet or hide it at 0, and stress it only when there is something to review.

**Phone 390×844 and 200 % text**
27. Phone: `Start over` wraps to two lines (104×68), and the step labels wrap. Chrome takes **292 of 844 px**: header 125, action bar 106, tabs 61. The bottom tab "New sale" wraps to two lines on the order page (`order107-phone-0.png`). The QR step says "Fill on this **iPad** instead" on a phone.
28. At 200 % text the header search field shrinks to **145×68**, showing "Code, ı" (`z200-items-portrait.png`). Fix: let the header wrap so search takes a full row below 1101 px when text is large, using a container query or `flex-wrap`.

**Login and session**
29. The title is "Staff sign in" but the button says "**Enter**". The demo accounts run together ("…/ gaby andres@…"). Submitting an empty password goes to the API. With the email prefilled, the password field is not focused, which matters after every "Fill on this iPad" sign-out. Fix: in `LoginPage.tsx`, label the button "Sign in", add `autoFocus` on the password when an email is present and `enterKeyHint="go"`, and require the field client-side. The mock's wrong-password message, "Unknown account. Use Gaby or Andres.", is misleading.
30. The More menu centres "Log out" with the same style as the navigation items, directly above a left-aligned "Close menu" (`more-menu-portrait.png`). An accidental tap costs a password re-entry. After a voluntary logout, Back shows "Session expired". Fix: separate Log out with a divider, align the list left, and add the `expired` flag only on a 401.

---

## What works well
- **Double submit is safe.** A double-tap on `Create order & show QR` created exactly one order, and a double-tap on `Mark paid` produced one payment and one notice.
- **Session handling is solid.** Removing the token in another tab immediately sends this tab to `login?expired=1&next=/staff/sales/new` with "Session expired, sign in again." After signing in, the draft is restored.
- **Handover safeguards:** "Customer handoff" signs staff out before opening the form, and the dialog is clear. Cancel is disabled on handed-over orders, with a reason. The cancel dialog lists painted items and money received, and focus returns to its trigger.
- **One selection style throughout:** green 2 px border with tint on segmented controls, hour chips, date cards, nav tabs and payment states. Every measured control is at least 44 px, and every control radius is 12 px (8 px for help, pill for back links).
- **Contrast passes everywhere I measured:** muted text is 4.82–5.43:1, the status "Painting" is 6.51:1 and body text is 14–16:1.
- **Stock shows on each colour and finish choice** ("Red · 6 left", "Shiny · 3 left"). Deposit validation is inline, with a clear hint (50 % = €25.00) and a disabled button.
- **Attention list and search** are fast and simple. Pending and review rows explain themselves, and the review order shows an explicit Stripe alert.
- **The completion dialog** ("Complete order?") previews every ornament's new state before confirming.
