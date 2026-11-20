# Staff iPad feedback round 3 (owner, 2026-11-20 evening) — queued until the current agents finish

Agenda (Argon follow-up, AgendaPage files):
1. The red "now" line is drawn under the order blocks: it must sit above them (still non-interactive).
2. Header: below "Agenda" remove the market name line (the top bar already shows the market) and the
   "Gaby paints at …" line (shown only in the Gaby-away card). Remove the "Today" text next to the gear and
   align the gear button with the "Agenda" title row.
3. Pickups and deliveries: no "All deliveries" (already in the current brief; verify it is gone). Nothing
   overlapping or redundant.

New sale (Codex follow-up, NewSalePage):
4. Verify the order summary panel is gone while the sale is empty and the two choices are the only content,
   big and easy to tap on iPad. Remove the step labels line ("Items · Delivery · …") while empty; keep it
   minimal.

Painting finished early frees the slot (Codex follow-up, backend + mock + agenda data):
5. If an item is marked painted (Ready) before its session ends, the rest of the session is free again so it
   can be booked. Example: now 15:30, session 17:00–18:00 already painted → 17:00–18:00 becomes free.
   Proposed rule: on marking painted at time T on the paint date, the session ends at T (rounded up to
   15 min); if T is before the session start, the session becomes [T−15 min, T]. Capacity and suggestions
   count only the recorded time. Reverting to "to paint" keeps the shortened time (staff can move it).
   Tests in backend and mock.

Owner approved rule 5 as proposed (2026-11-20).

Sales page (`/staff/sales`, `SalesPage.tsx`; Codex follow-up because it needs the order list DTO):
6. Better use of the iPad screen and clearer UX: each sale row shows code, customer, items (kind + photo or
   colour), total and payment state, source (stall / web) and **the market where it was sold** (sold-on
   market day; web orders say "Web shop"). Add `soldAtMarketName` (nullable) to the order list summary in
   backend, mock and types. Optional filter by market when there are two that day.
7. Remove the "New sale" button from the Sales heading and the page's own search field (the header search
   already does this). Keep Today / 7 days / All and pagination; keep the URL params working.

New sale stepper (Codex follow-up, NewSalePage):
8. The step line "Items · Pickup and paint · Payment" is cramped and unclear. Replace it with a clear stepper
   like the customer flow (`/buy` step indicator): numbered circles 1–2–3 with short labels, the current step
   highlighted, done steps marked with a check, enough spacing; readable at a glance on iPad 820/1180 and at
   phone 360. Hidden while the sale is empty (item 4). Keep `aria-current="step"`.

Agenda, more (owner, 2026-11-20 evening; Argon follow-up with items 1–3):
9. Day strip: days with a market show a small market icon (stall/awning SVG, no new image files); hover
   (desktop) and tap-and-hold / title + accessible name (iPad) reveal which market(s) that day,
   e.g. "Rathausplatz · Spittelberg". Keep the day buttons the same size.
10. Painted (Ready) sessions in the future part of the day no longer occupy the calendar: the slot is free
   (backend already shortens the session on Ready, see item 5). In the calendar, show what was there only as
   a very light trace: e.g. a thin, low-contrast marker at the session's original/recorded time with a small
   "✓ AWG0101 painted" info chip that opens the order, or a "+N painted" chip at the right of the hour row.
   It must never cover a bookable slot nor take a tap target from a real block. Past sessions: no special
   treatment. Propose the cleanest option in your report and implement it.

New sale "Make room today" (owner, 2026-11-20 evening; staff phase, needs the make-room backend from the Post
shipping branch, contract in ../awg-post-shipping/tasks/post-shipping-contract-2026-11-20.md):
11. When a custom pickup today has no painting time left, show a primary button "Make room today" right under
    the message. It calls the make-room endpoint for the needed minutes at today's painting market, then shows
    what moved ("AWG0101 moved to Mon 10:00") and selects the freed slot. If nothing can move: "All of today's
    sessions are for pickups today, so none can be moved." Replace the current "Move another order's paint
    session" control. Corner cases: double tap (idempotency), another iPad booking the slot meanwhile (409 →
    retry message), Gaby elsewhere today (button hidden; say where she paints), sale abandoned after the
    move (moved sessions stay valid; no undo needed but say so).
    Owner addition: after a move, show a small confirmation popup (StaffDialog, X/Escape/tap outside) listing
    each moved session as one row: photo + order code, "Sat 14:00 → Mon 10:00" with an arrow icon between
    the old and new slot (from/to come from the make-room response `moved[]`), then "Your slot: Today
    14:00–15:00". One OK button. Same popup when moving from the Agenda.

Agenda calendar blocks (owner, 2026-11-20 evening; Argon follow-up):
12. Blocks must not be coloured by status (the current per-status fills are confusing and dizzying). All
    blocks share one calm neutral surface (existing staff token). The status is a small tag at the right of
    the block: "To paint", "Painting", "Ready", "Delivered" (each tag may have its own subtle tone; text
    contrast WCAG AA). Under the order code show the customer's name (one line, ellipsis), then the handover
    line ("Pickup Sat 15:30" / "Vienna Wed 18–20"). Photo stays on the left. Also apply to the Pickups and
    deliveries cards for consistency.

PM review of Argon's agenda-away screenshots (tasks/audit-results/agenda-gaby-away-shots/), fix with round 3:
13. Gear dialog "Gaby paints at" shows "No market selected" while the Agenda says "Gaby is painting at
    Rathausplatz" (resolved by the automatic rule). The select must show the effective market: when no
    explicit choice, label the option "Automatic · Rathausplatz" (selected), plus the explicit markets.
14. Counts disagree: the away card says "6 sessions booked there" while the header says "3 of 6 booked".
    Use one source and one wording ("3 booked · room for 6"), consistent in header, card and gear.
