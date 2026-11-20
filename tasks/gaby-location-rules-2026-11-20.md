# Gaby's location drives painting + New sale empty state (owner, 2026-11-20)

Context: `tasks/two-markets-2026-11-20.md` (two stalls open 25–29 Nov 2026; Wed–Fri one market, Sat–Sun two).
Each painting day already has a resolved "Gaby paints at" market (`PaintingDay` paints-at → primary →
earliest stall; see `CalendarIndex.effectivePaintingStall`). Staff set it in the Agenda gear.

## Owner's rules (now decided)

1. **Same-day painting only where Gaby is.** A custom ornament painted on day D and handed over at a
   market on the same day D is allowed only if that market is where Gaby paints on D. A seller at the other
   stall cannot promise "ready in an hour": they must pick another day.
   - Backend invariant (all paths that book or move a paint session: staff sale, move/reschedule, web
     checkout): if `paintDate == handoff date` and the handoff is a market pickup, the handoff market day's
     market must equal the effective "Gaby paints at" market for D. Otherwise 409 with a new stable code
     `PAINT_NOT_AT_THIS_MARKET` (add to `frontend/src/lib/apiError.ts` with an English staff message:
     "Gaby is painting at <market> that day. Pick another day."). Take the `ScheduleLock` as today.
   - Changing "Gaby paints at" for a day that already has same-day pickups at the other market → 409 with
     the list count (like the existing market-edit validation), not a silent break.
   - Suggestions (`/api/agenda/...suggest` / the New sale plan) must skip such slots, so the automatic
     plan never proposes them.
2. **Web shop: nothing handed over during the first weekend.** The web shop sells, but every handover
   (market pickup and Vienna delivery) starts the following week: no web pickup day or delivery day before
   `awg.shop.deliveries-from` (already 2026-11-30). Make sure market pickup days use the same floor as
   deliveries (`firstDeliveryDay`); add a test that 25–29 Nov never appear in `POST /api/shop/pickup-days`
   and checkout rejects them. Keep the overlap fail-closed logic.
3. **New sale empty state (iPad):** while the sale has no items, show only the two big choices
   (Custom / Finished) filling the content width, large and easy to tap (min 120 px tall on iPad), with
   their icons — **no order summary panel on the right** and no €0.00 total. When the first item is added,
   the normal layout (items + summary) appears. Check `NewSalePage.tsx` and `OrderSummaryPanel`.
4. **New sale at a stall where Gaby is not painting today:** the paint-day choices for a custom ornament
   must not offer today (or any day where the pickup market ≠ Gaby's market for same-day pickup); show a
   short line under the date choice: "Gaby is painting at Rathausplatz today." (market name from data).
   Default to the next valid day.

## Out of scope for this brief (another agent owns these files)
`AgendaPage.tsx/.module.css`, `PaintingDaysPage`, the gear dialog. Do not edit them.

## Done when
- Backend tests: new tests for rule 1 (same market OK, other market 409, move, web checkout, suggestion
  skip, paints-at change blocked) and rule 2. `./mvnw test` green (Byte Buddy agent as in AGENTS.md).
- Mock (`frontend/src/api/mock/`) enforces the same rules with the same codes.
- `VITE_DATA_SOURCE=http npm run build`, `npm run lint`, `node --test tests/*.test.mjs` pass.
- Update/add e2e in `e2e/two-markets.spec.ts` (other-stall sale cannot pick today) and the empty New
  sale layout; do not run Playwright (Claude runs it).
- Document the rule in `awg-tracking/README.md` (two-markets contract section).
- Short report.
