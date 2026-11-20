# Staff iPad feedback (owner, 2026-11-20) — round 2, after the nav/agenda cleanup

Queued for the next agent once the current tests and audit finish.

1. **Nav: only two buttons.** The Agenda button should not sit there looking "selected" just to get started. Proposal (to confirm): New sale (primary) + More; More shows an icon (chevron/menu) so it reads as a dropdown; Agenda is the home (AWG logo).
2. **Today's gear (painting capacity).** "6 of 10 bookings" plus an editable number of paintings is confusing. Capacity depends on how many hours Gaby works that day, not on a number typed in. The gear edits only the painting hours (start–end) and open/closed; the maximum follows from the hours (1 block ≈ 60 min, consistent with AGENTS.md: 10–13 → 3, 10–12 → 2). Show it as hours + bookings, e.g. "10:00–13:00 · 2 of 3 booked". Backend: derive the max from the hours (keep existing rows working).
3. **Move session:** long-press the session itself in the calendar to move it, not a button at the top.
4. **Add paint session** = New sale (already removed; check nothing is left).
5. **Section titles:** a title above the calendar (e.g. "Paint sessions"), matching the existing "Pickups and deliveries" title, so left = calendar and right = pickups/deliveries are clear.
6. **Pet photo bigger** inside the calendar block, using the space the block has.
7. **Calendar block content:** we no longer ask for the pet's name, so the block shows the **order code** instead of a name. Do **not** show the painting time inside the block (its position in the calendar already says it; tapping opens the order). Show instead the **delivery/handover time and type** (market pickup vs Vienna delivery), e.g. "AWG4K2Q9 · Pickup Sat 15:30" / "Vienna Wed 18–20".
8. **Finished ornament in New sale: no popup.** Instead of a "Choose piece" button that opens a dialog, show the Ready pieces (photo-first tiles, search + colour/finish filters) inline in the sale right away; tapping a tile adds/selects it. Keep the selected piece's photo on the sale item.
9. **Pickups and deliveries column (agenda):** still shows the pet name (e.g. MILO) and 'Personalised · no name' noise, plus an odd 'All deliveries' sub-heading — trim to code, time, type, status.
