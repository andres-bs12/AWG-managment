# Flow and staff UX audit — 2026-11-12 (v3.1)

Auditor: Claude Opus subagent (Playwright Chromium, mock mode, frozen copy of commit 2136014; 390×844, 1280×800, 820×1180). Screenshots: /private/tmp/claude-501/awg-audit/shots/ (local, not committed).
Counts: P0 1 · P1 24 · P2 30. Status of each item is tracked in the v3.1 fix log at the end.

## P0
1. Track labels a custom ornament without back name "Nicht personalisierte Kugel" (`components/public/OrderReceipt.tsx:19`).

## P1 — public
1. /buy review says "Kugel 1" with a single ornament (`buy/BuyReviewStep.tsx:25`).
2. /buy review repeats the name (title "Kugel 1 – Luna" + "Name: LUNA (+€ 12,99)").
3. /form review shows the name three times, lowercase (`form/FormReview.tsx:19-26`).
4. /form back-name field truncates silently, accepts non-letters (`form/FormItems.tsx:49` vs `buy/BuyItemsStep.tsx:38`).
5. Market pickup carts still show "Lieferung · Gratis" (`BuyReviewStep.tsx:57`, `BuyPage.tsx:400`).
6. /form desktop dead gap before "Notiz für Gaby" (field column stretched to preview height).
7. Track saved banner flush on the card and 10 px wider each side (`TrackPage.module.css .savedBanner`).
8. /form and /buy review cards use different layouts and title separators.

## P1 — staff
9. New custom item defaults to sold-out Red/Shiny (`NewSalePage.tsx addItem`).
10. "Waiting for customer form" box touches the next block (0 px).
11. QR step mixes a full-width "Change date" with a left-aligned "Copy link to send".
12. Choosing Delivery in New sale leaves a stale "Rathausplatz · Market day" summary/hint/"Pickup" label.
13. Phone: next New sale step opens at the old scroll position.
14. Done screen hides the remaining balance after a deposit and the QR while the form is pending.
15. Phone: "+ Add paint session" / "Move sessions" only in Calendar view; phones open in List.
16. Agenda toolbar wraps into three ragged rows on phone; uneven gaps.
17. Agenda pickups show "Collect €56.48" on every row of one order (reads as double).
18. Deliveries: Hand over disabled with no reason.
19. Deliveries: no address/district outside "Open delivery run".
20. Handover dialog unstyled (native fieldset, 13 px checkboxes), four competing actions, vague "Save".
21. Dialogs close inconsistently (Escape/backdrop/X/"Not yet").
22. Order detail has two handover controls (per item + "Mark picked up / delivered").
23. Stock edits need Save per row; lost silently on navigation.
24. Paint page 11 px too wide at 390 px.

## P2 (abridged)
Missing space in "Paint Sat, 28 Nov ·15:30"; New sale header off-centre, summary shows a place before choice, "Add name · €12.99" wording, stray divider, stock hints ignore draft, text glyph icons, invalid deposit still labels the button; Agenda Today button alone, now-line hidden behind blocks, "Held by web checkout" twice, hatch through text; pickup rows show finish without colour and "Walk-in" twice; Deliveries chips clipped, ~40 px gap above first order, uneven indent, run not sorted by district; Order detail hint touches label, low-contrast pill, back link label, pending web orders offer painting/handover; Painting days stepper misaligned and unlabeled, "6/2 booked" cryptic; Stock finished row indent, no colour heading; Markets editor uneven spacing; More menu indent and no current marker; Search exact code doesn't open the order, umlauts, hint stays; Change password error at top; Sales list deposit rows hide balance; /buy copy (intro says delivery only, "Kugel (1)" vs "Kugel"), error wording differs /buy vs /form, 2-digit phone passes, review photo row and wrapping surcharge.

## v3.1 fix log
- Fixed before the audit report arrived: #18, #19 (address + district on every Vienna card), #21 (X, Escape, backdrop; "Not yet" removed), "Retry configuration" (New sale load bug, painting-day ranges > 62 days).
- #23 kept as is: the owner asked to keep Save with a "Saved" confirmation on Stock (2026-11-12).
