[agent-run] id=20261120151008-audit-two-markets-7d63
### Findings (most severe first)

1. **P1 — Editing or adding a stall on an overlap date can strand booked painting sessions**
   `MarketService.java:94-97`, `AgendaService.java:72-84`
   - **Scenario:** With no `PaintingDay` hour override, `AgendaService` inherits painting hours from `index.dayByDate(date)` (the stall with the lowest `MarketDay.id` UUID). On an overlap date where stall A (lowest UUID, 10–19) and stall B (12–21) are open and a painting is booked at 10:00–11:00, narrowing stall A to 12–19 sets `onlyStall = false` (`stalls.size() == 2`) and skips the painting-hours conflict check, stranding the 10:00–11:00 slot. Similarly, adding stall B (12–21) on a date with stall A (10–19) skips the check (`onlyStall = false`); if B’s new UUID sorts before A’s, `dayByDate` flips to B and strands the 10:00–11:00 slot.
   - **Fix:** Whenever `inheritsHours` is true and a date has paintings, either validate paintings against the effective post-save `dayByDate(date)` hours (or snapshot the prior painting hours into `PaintingDay` before mutating an overlap date).

2. **P1 — Deleting the lowest-UUID stall on an overlap date can strand painting sessions**
   `MarketService.java:171-177`
   - **Scenario:** Stall A (lowest UUID, 10–19) and stall B (13–21) share a date with no `PaintingDay` override and a painting booked at 10:00–11:00. Stall A has no sales or pickups. Deleting stall A succeeds because `lastStall` is `false`; painting hours jump to stall B’s 13–21, stranding the 10:00–11:00 booking.
   - **Fix:** In `assertDayCanBeRemoved`, if `!lastStall` and `day` is `stalls.getFirst()` and `PaintingDay` inherits hours, check that all paintings on `day.getDate()` fit inside the next remaining stall’s hours (or snapshot the inherited hours into `PaintingDay`).

3. **P2 — Web shop fails open to a random-UUID stall when `primaryPickupMarketId` is unset**
   `ShopService.java:233-238`, `application.properties:57`
   - **Scenario:** `SHOP_PRIMARY_PICKUP_MARKET_ID` defaults to empty (`null`). On an overlap date, `webPickupDay` hits `primary == null` and returns `stalls.stream().findFirst()` (lowest random `MarketDay.id` UUID), so both `/api/shop/pickup-days` and `/api/shop/checkout` offer and accept an arbitrary stall instead of only an explicitly marked primary.
   - **Fix:** When `stalls.size() > 1 && primary == null`, return `Optional.empty()` so overlap dates are not offered until a primary market is configured.

4. **P2 — Missing overlap-date test coverage**
   `TwoMarketsApiTests.java:41-84`, `ShopApiTests.java:88-120`
   - **Gaps:** No test deletes the pickup-only stall (`two.dayId()`, where `handoffDay` matches but `soldOnDay` does not), deletes a market with overlap pickups, books a `CUSTOM` ornament on an overlap date, edits/deletes stalls with booked paintings on an overlap date, tests `ShopService` with `primaryPickupMarketId == null` or closed on the overlap date, or runs `V16` against PostgreSQL.
   - **Fix:** Add API tests for those overlap cases and verify `V16` on PostgreSQL.

5. **P3 — V16 backfill ignores `sold_on_day_id` on pre-existing overlap dates**
   `V16__handoff_market_day.sql:5-14`
   - **Scenario:** PostgreSQL execution is safe (`ORDER BY md.id LIMIT 1` avoids multi-row errors and matches `CalendarIndex`), and `null` old rows are handled cleanly. However, if two markets already existed on the same date before V16 ran, a same-day sale at stall B gets backfilled to stall A if A’s UUID is smaller.
   - **Fix:** `ORDER BY (md.id = oi.sold_on_day_id) DESC, md.id LIMIT 1`.

**Verified clean:** null handling for legacy rows (`CalendarIndex.pickupDay`, `ViewMapper`, `InvoiceRenderer`, `TrackingService`, `AgendaService`), pickup-at-B resolution across all read paths, `ShopService` rejecting non-primary/closed `marketDayId` when primary is set, deleting a day with pickups (`existsBySoldOnDayOrHandoffDay`), and Vienna `Clock` timezone usage.

