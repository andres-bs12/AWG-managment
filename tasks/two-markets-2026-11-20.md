# Two simultaneous markets — owner's answers (2026-11-20)

Applies to the **first market only: Wednesday 25 – Sunday 29 November 2026** (two markets open at the same time). Edge cases must still be handled correctly.

- Each person works at **one market at a time** and signs in with their own account **at that market** (Gaby at one, Andrés at the other). The app must know which market this session/iPad is at.
- Everything stays **fully synchronised** (one backend, live data). Each market has its own sales and pickups; both people see their own market first.
- **Painting happens only where Gaby is.** If Gaby is not at a market on a day, ornaments for that market and day cannot be painted there. Staff can state where Gaby is; be careful with any automatic scheduling or delivery decisions built on it (suggestions, capacity, pickup dates, web shop).
- Design proposal and questions: Gemini Argon (in progress, read-only). No code until the owner reviews the proposal.

## Plan (PM, after Argon's proposal — `tasks/audit-results/two-markets-argon-2026-11-20.md`)

Adopt Argon's minimal-change proposal (§3) with these decisions:

1. **Market per session:** after sign-in, if more than one market is open today, the staff member picks "I'm at: Market A / Market B" (remembered per device in localStorage, changeable from More; no "All stalls" mode needed for the first weekend — pickups list can still show the other stall's items behind a filter).
2. **Persist the pickup market:** V16 adds `order_item.handoff_day_id` (FK market_day) with backfill; sales send `soldOnMarketDayId` = the session's market day; read paths prefer `handoffDay` over the date guess (ViewMapper, InvoiceRenderer, Track, Deliveries, Agenda).
3. **Remove the "one market per date" rule** in MarketService (checks by MarketDay id). Choice lists key by `marketDayId`, labelled "Market name · Fri 28 Nov".
4. **New sale pickup:** defaults to this stall; the other stall is offered as an option, clearly labelled.
5. **Painting:** stays one schedule per date (Gaby's). Add an explicit "Gaby paints at" market per painting day (nullable, set by staff in the gear). Nothing is automated from it yet beyond showing it in the Agenda header and in New sale ("Painted at Market A"). No automatic capacity/delivery changes (owner: be careful).
6. **Numbered finished stock:** one shared picker (the seller holds the physical piece).
7. **Web shop pickups during overlap:** OPEN QUESTION for the owner (offer both stalls with names, or only one). Until answered: offer only the market marked as primary for that date (safest), configurable.

Ignored from Argon's §Problem 2 because they contradict the owner: a top-level Pickups tab (owner: only New sale + More; Deliveries in More).

Stall speed backlog (from Argon §Problem 2, to do after two-markets, owner to confirm): hide the per-item paint-time selector (auto 60/75 min); remove "Move another order's paint session" from New sale; only REVIEW orders light the red dot (not PENDING Stripe); order detail puts Mark picked up / payment first; QR + order code + payment on one screen; Deliveries defaults to Today · this stall with a name/code filter.
