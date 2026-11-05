# Staff UX review: Agenda and operations (2026-11-05)

Reviewer: Claude (read-only; no app source changed). Mock dev server `http://localhost:5173` (`VITE_DATA_SOURCE=mock`), logged in as the demo staff user. I drove headless Chromium (Playwright from `frontend/node_modules`) at 820×1180, 1180×820, 390×844 and 1440×900. Network failures were simulated by replacing `src/api/mock/entry.ts` in the browser with a proxy that rejects named API calls using the HTTP adapter's message, `Could not reach the server. Check your connection.` Server error codes were injected the same way.

Evidence folder (scratchpad, not in repo): `/private/tmp/claude-501/-Users-andresbejarano--claude-spares-spare-CKGUvj/7c990aca-0c8a-4dff-b2b8-a1a64e025cda/scratchpad/ux-staff-b/shots/`. File names are given below as `shots/<name>.png`. Scripts `s1.mjs`–`s19.mjs` and `lib.mjs` are in the parent folder. The mock store is reset for each browser context.

Scope: Agenda, Deliveries/delivery run, Paint view, Markets/market days, Stock, Painting days and Password.

Severity: **P0** broken · **P1** hurts the workflow · **P2** polish.

**No P0 found.** Every flow I ran completes end to end in the mock: move block, add session, handover with and without balance, delivery run, stock conflict, market edit/delete-day staging, painting-day save and password change.

---

## P1: hurts the workflow

### P1-1 Deliveries: "Mark picked up" sits closer to the next order's card than to its own
- **Screen/viewport:** `/staff/deliveries`, all viewports (`shots/L-deliveries-p.png`, `shots/deliv-web-pickup-p.png`).
- **Evidence:** Each row is `<div><DeliveryRow/><Button/></div>` with no wrapper spacing. The card has `margin-bottom: 8px`. The button's bottom edge touches the next card: Milo card 676–750, button 758–802, Bruno card starts at 802, so the gap is **0px**. The button visually belongs to the card *below* it, which is inverted proximity at a busy stall.
- **Fix:** `pages/staff/DeliveriesPage.tsx`: give the row wrapper a class, for example `.item { display:grid; gap: var(--space-2); margin-bottom: var(--space-4) }`. Remove `margin-bottom` from `.dlv` in `components/staff/DeliveryRow.module.css`. A better option is to render the action inside the card's right column, as `ViennaDeliveryCard` already does.

### P1-2 Deliveries: the list re-sorts right after a handover, putting another order's button under the finger
- **Screen/viewport:** `/staff/deliveries?day=2026-11-28`, 820×1180 (`shots/handover-1-after.png`).
- **Evidence:** I tapped Bruno's "Mark picked up" at (73, 904). Bruno is handed over at once (no confirmation without a balance) and jumps to the bottom (`sort(handedOver)`). `elementFromPoint` at the same spot now returns **Felix's "Mark picked up"**. Here it is disabled; with a finished next order, a double tap would hand it over. No status message confirms which order was handed over.
- **Fix:** In `DeliveriesPage.tsx`, keep handed-over rows in place until the next load or filter change, for example by sorting only on initial data. Announce `"<code> handed over · Undo"` in a `role="status"` line next to the row.

### P1-3 Deliveries: mixed or multi-ornament orders show only the first ornament
- **Screen/viewport:** `/staff/deliveries`, all viewports.
- **Evidence:** The dedupe in `DeliveriesPage.tsx` (`findIndex(orderId && deliveryKind)`) keeps one row per order:
  - AWG0107 shows only **"Pip · Started"**, but the order also has **Dot · Ready** (Agenda lists both).
  - The web order AWGVKKTFL (2 ornaments, created via `shop.checkout`) shows only "Schnuffelchen…"; "Rex" is hidden.

  The painter cannot see at the stall how many ornaments to hand over, or why the button is disabled.
- **Fix:** Group instead of dropping. Pass all items of the order to the row and render `"Pip, Dot · 2 ornaments"` with a per-item status (`"1 of 2 ready"`). Base the disabled reason on the group.

### P1-4 Deliveries: Vienna rows never show their delivery date
- **Screen/viewport:** `/staff/deliveries` (`shots/L-deliveries-p.png`, "Home deliveries" section).
- **Evidence:** Rows show `methodLabel` **"Vienna · Wed/Fri"**. This label comes from the backend too (`AgendaService.java:127`). `buildSections` puts every Vienna row from all days into one undated "Home deliveries" section. Anna, Otto and Lena appear right under "Today" with no date.
- **Fix:**
  - In `AgendaService.java:127`, return `"Vienna · Wed 2 Dec"` (the handoff date).
  - In `DeliveriesPage.tsx`, group Vienna rows by date under `Wed, 2 Dec` headings instead of `uniqueVienna`.
  - Mock note: in the mock, Vienna items without `marketDayId` match every Wed/Fri (`viennaBelongsToDate`), so mock data cannot show this correctly either.

### P1-5 Agenda: a failed "Save move" error appears behind the modal
- **Screen/viewport:** Agenda calendar, move mode, 820×1180 (`shots/move-4-fail.png`).
- **Evidence:** With `agenda.moveBlock` failing, the dialog stays open with no message. The only `role="alert"` is rendered **outside the `<dialog>`** at y=470, under the backdrop. It also pushes the board down by about 60px. The painter sees nothing happen. A retry then succeeds (`shots/move-5-after.png`).
- **Fix:** In `AgendaPage.tsx`, render `{moveError && <p role="alert">}` inside the "Confirm schedule change" `StaffDialog`, as the "New paint session" dialog already does. Suppress the page-level alert while `moveProposal` is set.

### P1-6 Agenda: blocks shorter than 60 minutes, and any block at 200% text, render overlapping text
- **Screen/viewport:** Agenda calendar on 1 Dec, 820×1180 and 1180×820 (`shots/lena-clip-p.png`); at 200% text (`shots/z200-agenda_date_2026_11_28_view_calendar-p.png`).
- **Evidence:**
  - Lena 11:15–12:00 is a **56px** block. Its three lines need about 76px, so they overlap: "Lena" is cut at the top, and "Delivered" is cut at the bottom.
  - The cause: `.slot` is a flex column with `overflow:hidden`, and its children have `overflow:hidden`, so they shrink (`min-height:0`) and overlap instead of clipping.
  - At 200%, every block clips: for example "Milo" is 25px visible of 40px needed. The hour gutter shows "12:0" because the 56px column is too narrow.
- **Fix** (`pages/staff/AgendaPage.module.css` and `AgendaPage.tsx`):
  - Add `.slot > * { flex-shrink: 0 }`.
  - Add `data-compact` when `height < 76`, which renders one line `"Lena · 11:15–12:00 · Delivered"`.
  - Make `--size-agenda-hour` scale with text, for example `max(80px, 5rem)` (keep the numeric geometry in sync).
  - Make the hour column `minmax(var(--space-7), max-content)`.

### P1-7 Markets editor: save and conflict errors appear off-screen and focus is lost
- **Screen/viewport:** `/staff/markets/mkt-rathaus` at 820×1180 and 1180×820 (`shots/market-dayconflict-p.png`, `shots/market-save-fail-p.png`).
- **Evidence:** I tapped Save at the bottom of the form.
  - With an injected `DAY_HAS_DELIVERIES` (`field: 'days'`), the only alert is at **y = −65** (portrait) and **y = −380** (landscape). It is scrolled out of view above.
  - `document.activeElement` becomes `<body>`, because Save is disabled while busy.
  - No day row is marked (`aria-invalid` count 0).
  - The network failure behaves the same way (scrollTop 303, alert at y=−65).
  - In the mock I could not trigger the conflict through data: web Vienna orders have no `marketDayId`, so `deliveryDateForItem` returns null and Spittelberg saved Fri 11 Dec as a stall day (`shots/spittel-conflict-p.png`).
- **Fix:** In `MarketEditorPage.tsx`:
  - Repeat the error in `.actions` next to Save and move focus to it (`ref.focus()`, `tabIndex=-1`).
  - For `field==='days'`, parse or match the date and add an error line plus `data-invalid` on that `<li>`.
- **Mock fix:** In `api/mock/store.ts`, `deliveryDateForItem` should return `item.delivery.deliveryDate` for Vienna items.

### P1-8 Markets editor: five filled red "Delete day" buttons outweigh Save, and the label is wrong
- **Screen/viewport:** `/staff/markets/mkt-rathaus`, all viewports (`shots/market-edit-p.png`).
- **Evidence:**
  - Every day row has a solid `rgb(154,59,59)` danger button (115×44), while Save is a single 72px-wide primary.
  - The button says **"Delete day"**, but the action only stages a removal: the dialog reads "Remove … from this draft? The day is deleted only when you Save."
  - The time inputs in the same rows are the only fields with **0px radius and a 2px ink border**. Other inputs have a 12px radius and a 1px `--color-control-border`.
- **Fix:** In `MarketEditorPage.tsx`, change day removal to `variant="ghost"` with error-coloured text, labelled **"Remove"**. In `MarketEditorPage.module.css`, delete the `.input` border override so `Field`/staff defaults apply (radius 12, control border).

### P1-9 Painting days: 28 rows × 147px with 28 Save buttons, and past days are editable
- **Screen/viewport:** `/staff/painting-days`, 820×1180 (`shots/L-painting-days-p.png`, scroll height **4,947px**).
- **Evidence:**
  - Every day is a 760×147 card with a checkbox, stepper and its own primary Save.
  - Changing one week takes 7 saves. Mon 23 – Fri 27 Nov (before "today", 28 Nov) are still editable.
  - **"6/2 booked"** on Sat 28 Nov is plain muted text `rgb(92,107,128)`, the same as "0/2 booked", so over-capacity is not flagged.
  - The "Open" checkbox is a native **13×13** box inside a 70×44 label; `--size-check` is 24px.
- **Fix** (`PaintingDaysPage.tsx` and `SettingsRows.module.css`):
  - Use a compact table per week: one 56px row per day with day, booked/max, open toggle and stepper.
  - Use one sticky "Save changes (n)" per page, or autosave each change with a status message.
  - Hide or lock past days.
  - Render `booked > max` with the warning token and the text "Over limit".
  - Size the checkbox to `--size-check`.

### P1-10 Agenda header: "6/2 paintings today · Manual reservations may exceed the automatic limit"
- **Screen/viewport:** Agenda, all viewports (`shots/L-agenda-p.png`).
- **Evidence:** On the stall day the painter sees "6/2". The limit is the web automatic cap, but the copy reads as "you are triple-booked". It sits in muted 16px text with no emphasis, directly under a lone "Painting days" button.
- **Fix:** In `AgendaPage.tsx`, show `"6 sessions today"`. Show the automatic cap only when it is relevant, as `"Web booking full (2/2)"`. Move the "Painting days" link into the toolbar or the More menu.

---

## P2: polish

| # | Screen · viewport | Evidence | Fix |
|---|---|---|---|
| P2-1 | Deliveries · 820/1180/390 | `document.documentElement.scrollWidth` = **1186** at 820 and 390 (**1989** at 200%). The `.visually-hidden` radios of the Day segmented control are absolutely positioned outside the horizontally scrolling row (right edge up to 1237px), so the page can pan sideways on iPad. | In `DeliveriesPage.module.css`, add `.dayFilters fieldset > div { position: relative }`, or add `position:relative` on `.seg` in `SegmentedControl.module.css`. |
| P2-2 | Agenda/DayStrip · all | Disabled ghost buttons gain a border and grey fill (`StaffButton.module.css` `.btn:disabled`), so "Today" (on today), "‹" (first day) and "Move sessions" (no movable blocks) look more clickable than when enabled. The enabled "Today" is bare text (`shots/day-2026-12-01-p.png` vs `shots/agenda-p.png`). | Add `.ghost:disabled { background: transparent; border-color: transparent; }`. Make "Today" `variant="secondary"`. Hide "Move sessions" when nothing is movable, or show "No sessions to move". |
| P2-3 | DayStrip · all | Weekday line renders **"Fri,"** with a trailing comma (label split on space from `"Fri, 27 Nov"`). | In `components/staff/DayStrip.tsx`, use `.replace(',', '')` or format the weekday and date separately. |
| P2-4 | DayStrip · 390 / 820 | 390: 2.5 chips visible, with "29 N" cut by the scroll edge. 820: the 8th chip is cut at x≈750. The "Day" legend wastes a row. | Use scroll-snap with `scroll-padding`, size chips so that whole chips fit (`flex-basis: calc((100% - gaps)/n)`), and drop the "Day" label (the select already has an `aria-label`). |
| P2-5 | Agenda calendar · 820/1180 | The now-line (`.now` z 3, above `.slot` z 2) crosses Felix's "To paint" text: line at y 700, text 697–713 (`shots/felix-now-p.png`). | Set `.now { z-index: 1 }` and add a small time pill in the hour gutter. |
| P2-6 | Agenda move · 820 | The invalid drop preview has no time label and no reason; the reason appears only after release (`shots/move-invalid-drag.png`). The confirm dialog says "Move **AWG0103**?", but painters think in pet names. | Keep the time in `.previewBad` and add "Overlaps Pip". Use `Move Anna (AWG0103)?`. |
| P2-7 | Agenda list · 390 | Dates mix formats: "Market 28/11 · 14:00" in rows vs "Sat, 28 Nov" in the header and chips. | Use one formatter, `Sat 28 Nov · 14:00`, in `handoffLabel`. |
| P2-8 | Handover "Balance due" dialog · 820 | The error appears twice: inside the dialog and again on the page (`onError` + `setError`; `shots/handover-3-fail.png`). The in-dialog error is unstyled body text. Buttons flow inline with 8px margins, and "Keep order" wraps alone, unlike the right-aligned `.actions` of the other dialogs. "Hand over with balance due" has the same weight as the safe option. | In `useHandover.tsx`, skip `onError` while the dialog is open. Use `.actions` (12px gap). Make the risky action `ghost`. Rename "Keep order" to "Cancel". Show the amount large. |
| P2-9 | Deliveries · all | A disabled "Mark picked up" gives no reason. The delivery-run card does: "Finish before handoff." | Reuse that line under the button in `DeliveriesPage.tsx`. |
| P2-10 | Deliveries / Agenda side · all | Web pickup rows look the same as stall rows: no "Web · paid" marker and no customer name, so a customer arriving at 17:30 can't be matched by name. The empty-photo placeholder is a blank 48px square. | In `DeliveryRow.tsx`, add a `customerName` line and a "Web" tag with the arrival time ("arrives 17:30"). |
| P2-11 | Deliveries filters · 820 | The Production segmented control wraps to 2×2 (All, Not started / Started, Finished) while 290px stays free on the right. Each filter fieldset is fixed by the `minmax(180px,1fr)` auto-fit grid. | `.filters { grid-template-columns: auto auto 1fr }` from 768px. |
| P2-12 | Deliveries · all | The "Include past days" checkbox is a native 13×13 box; `--size-check` is 24px. | Use the shared checkbox styling. |
| P2-13 | Stock · 820/390 | In the stepper, −/+ sit at y=338, the input at y=322 and Save at y=304, so the three controls have different vertical centres. The label repeats the row title ("Custom · red · shiny quantity") and wraps to 2 lines. Seven always-enabled primary Save buttons are shown (`shots/L-inventory-p.png`). The page gutter is 30px (h1 x=30) vs 16px on Agenda/Deliveries. | In `SettingsRows.module.css`: `.stepper { align-items: end }`, use a visually hidden label ("Quantity"), enable Save only when the row is dirty, and use the shared gutter. |
| P2-14 | Stock conflict · 820/390 | "Use mine" (primary) silently overwrites a sale's decrement: server 1, typed 5 → saves 5 (`shots/stock-conflict-p.png`). | Label the buttons **"Save 5"** / **"Keep 1"** and make "Keep 1" the primary. |
| P2-15 | Stock · all | Colours are words only. | Add a `--size-swatch` swatch before the row name. |
| P2-16 | Market editor · 820 | The "Season cost" input sits 24px lower (y=382) than the dates (y=358) because of its hint. The form panel ends at x=776 (`max-width:760`) while the page header spans to 804. | Give the hint row to all three fields (subgrid) or move the hint below. Let the panel fill the column, or limit the header too. |
| P2-17 | Market editor · 820 | Validation "Stall number must be a whole number of 1 or more" appears at the top; the Stall field is not marked. | Use `Field` with `error` and `aria-invalid` on the stall number. |
| P2-18 | Shell bottom tabs · 820/390 | On Stock, Markets, Painting days and Password, no tab is current (all `aria-current=false`). | In `StaffLayout.tsx`, mark "More" as current for these routes. |
| P2-19 | Bottom tabs · 390 | "New sale" wraps to two lines (`shots/L-agenda-m.png`). The Agenda tab box touches "Deliveries". | Use `white-space:nowrap` with a smaller meta size, or the label "Sale". |
| P2-20 | Paint view · 820/1180 | "← Back" button next to the text **"Back: MILO"** (name on the back of the ornament). When an item has no colour, nothing is shown (Milo). | Use "Name on back: MILO" and `Colour: not set`. |
| P2-21 | Password · 820 | The error "Use at least 10 characters." is at the top of the card, not under New password. The confirm mismatch is not checked in the same pass. The hint says "72 UTF-8 bytes". The back link is inside the card and the card is centred, unlike other pages. | Use per-field errors in `ChangePasswordPage.tsx`, with hint "10–72 characters". Use the same layout as Stock. |
| P2-22 | Agenda slots | `.slot` radius uses `var(--space-2)` instead of a radius token. Native `<dialog>` text "Pickup stays…" is 14px meta, which is fine. | Use `--radius-small`. |

---

## What works well

- **Touch targets:** every button, link and segment measured ≥44px at all four viewports, in dialogs too (0 violations from the automatic scan).
- **One selection style:** the green 2px border plus tint is used consistently on day chips, view switch, filters, bottom tabs, stepper choices, the dragged block and the Cash/Card segment.
- **The move flow is clear:** an explicit "Move sessions" mode, a dashed preview with the time, a confirm dialog showing old → new time and an unchanged pickup, and correct placement after Save. "+ Add paint session" finds the first free hour or says "No free hour on this day…".
- **Handover safety:** a balance check before handover, with collect method and an explicit "hand over with balance due" option. The delivery-run cards show address, phone, Map, "Collect €31.49 · deposit" and a disabled reason.
- **Stock:** STOCK_CHANGED keeps the typed value and offers both choices. Network errors are shown in the row and keep the input. "Unsaved changes" and "Low stock: last one" cues are present.
- **Error copy:** the network message is short and specific everywhere; the market "Has orders" lock and "This market has orders and cannot be deleted" are clear.
- **Paint view:** large photo, filters (Color/B&W/Ink/Lines/Poster/Soft), zoom with Fit and thumbnails, with no small targets. Landscape fits on one screen.
- **Contrast:** muted text `#5c6b80` on white is about 5.3:1, and disabled text on the disabled surface is about 5:1.
