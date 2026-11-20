# New sale corner cases (PM review, owner 2026-11-20)

The owner wants the stall flow to "just make sense". Reported bug: holding free time in the Agenda calendar on
Sunday 15:00 opens New sale with that paint slot, but the delivery step still asks/offers **today** as pickup
(today is before the chosen paint time) and shows today's hours. A pickup can never be before the paint
session ends.

Files: `frontend/src/pages/staff/NewSalePage.tsx`, `saleDraft.ts`, `lib/` helpers, mock services. The Agenda
page is owned by another agent right now: do not edit `AgendaPage.*`. Backend changes only if a rule is
missing server-side (then add tests). Staff UI is English.

Rules to enforce (UI **and** server where it creates/moves a sale):
1. **Paint slot chosen from the calendar (`date/start/end` params, item `slotLocked`)**: the pickup day
   choices start at the paint date. Same day → only pickup times ≥ paint end (+15 min handling) at a
   market open that day where Gaby paints (two-markets rule). Earlier days never appear. Do not ask
   "today?" when the paint date is not today. The automatic plan must not move a locked slot.
2. **Paint date in the past or today with start already passed** (stale link / draft restored from
   sessionStorage the next day): drop the slot with a short notice and re-plan; never book in the past.
3. **Pickup chosen first, then paint**: paint suggestions are only before the pickup (same day only where
   Gaby paints, ending ≥ 15 min before the pickup time).
4. **Several custom items**: each item's pickup ≥ its own paint end; "same pickup for all" uses the latest
   paint end. Changing one item's pickup re-validates the others.
5. **Vienna delivery / web-style handover** (until Post shipping lands): delivery day ≥ paint date + 1.
6. **Finished pieces only**: no paint step, no paint day questions; "Deliver now" default at the stall.
7. **Mixed order**: finished pieces may be handed over now while customs wait; the summary says so clearly.
8. **Day full / painting closed / Gaby elsewhere**: the choice explains why in one short line and offers
   the next valid day; never a dead end.
9. **Draft restored after reload or after "Back"/Discard**: no stale slot, no stale pickup, no ghost items.
10. **Midnight / timezone**: all dates in Europe/Vienna; a sale opened at 23:50 and continued at 00:05 uses
    the new "today" correctly.

## Done when
- Each rule has a Node test (pure helpers) or an E2E test (`e2e/staff-review.spec.ts` or a new
  `e2e/new-sale-corner-cases.spec.ts`), including the owner's exact case (calendar hold Sunday 15:00 →
  pickup offers Sunday ≥ 16:15 or later days only).
- `VITE_DATA_SOURCE=http npm run build`, `npm run lint`, `node --test tests/*.test.mjs`; backend
  `./mvnw test` if touched.
- Run only your specs: `PW_PORT=5211 npx playwright test <your specs> --project=ipadPortrait --project=ipadLandscape --project=staff-phone-360x640`.
- Report: each rule → OK already / fixed (file) / needs owner decision.
