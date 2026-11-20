# Agenda: Gaby away + gear dialog + deliveries column cleanup (owner, 2026-11-20)

Staff iPad (820×1180 and 1180×820) is the target; also check phone 360×640. Staff UI is English.
Owner: "careful with the interface" — pixel-level quality, reuse existing staff tokens, no new hex colours.
Files you own: `frontend/src/pages/staff/AgendaPage.tsx`, `AgendaPage.module.css` and the painting-hours gear
dialog component it uses (find it from AgendaPage). Do NOT edit `NewSalePage.tsx`, backend, or the mock
(another agent is changing them right now).

1. **Gaby is not at this stall today.** The device's active market is "I'm at" (`awg-active-market-id`);
   the day's "Gaby paints at" market is already in the agenda data (shown today as "Gaby paints at X" under
   the title). When the selected day has a different paints-at market than the active market:
   - replace the Paint sessions calendar with one compact card: "Gaby is painting at Rathausplatz this day."
     plus "N sessions booked there" and a text button "Show sessions" that expands the normal calendar
     read-only (no hold-to-move, no hold-for-new-sale while viewing from the other stall);
   - when they are the same market (or only one market that day), the Agenda is exactly as today.
   - remove the duplicated header lines: the page subtitle shows the market name only once.
2. **Gear dialog "Painting hours · <date>"** (see owner screenshot): the End input overflows the card's
   right edge and Start/End touch each other. Fix the grid: two equal columns with a 16 px gap inside the
   card padding. Keep "Open" checkbox, "Gaby paints at" select.
3. **Pickups and deliveries column** (feedback item 9): remove the "All deliveries" sub-heading and the
   pet name (e.g. "· MILO"); remove "Sarah Müller · red shiny" noise lines that are not needed at the stall.
   Each card: photo, order code, time, type (Pickup at <market> / Vienna), status. The "Pickup market"
   select stays only when there are two markets that day, default = the active market.

Done when: `VITE_DATA_SOURCE=http npm run build`, `npm run lint`, `node --test tests/*.test.mjs` pass; update
`e2e/agenda-ipad.spec.ts` / `two-markets.spec.ts` selectors for these changes and add one test for item 1,
then run only those specs with `PW_PORT=5207 npx playwright test e2e/agenda-ipad.spec.ts e2e/two-markets.spec.ts --project=ipadPortrait --project=ipadLandscape --project=staff-phone-360x640`
and take screenshots of the agenda (Gaby here / Gaby away) and the gear dialog at both iPad sizes into
`tasks/audit-results/agenda-gaby-away-shots/`. Short report.
