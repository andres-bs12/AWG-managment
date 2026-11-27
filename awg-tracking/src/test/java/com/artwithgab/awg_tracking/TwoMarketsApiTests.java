package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.PaymentMethod;
import com.artwithgab.awg_tracking.enums.PaymentState;
import com.artwithgab.awg_tracking.repository.InvoiceRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "awg.test.clock=2026-11-25T08:00:00Z",
        "spring.datasource.url=jdbc:h2:mem:awgTwoMarkets;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
})
class TwoMarketsApiTests extends ApiTestSupport {
    @Autowired OrderRepository orderRepository;
    @Autowired OrderService orders;
    @Autowired InvoiceRepository invoices;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    private record Stall(String marketId, String dayId) {}

    private Stall openStall(String token, String name, int open, int close) throws Exception {
        var result = mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(MarketApiTests.marketBody(name, WED, open, close))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.days[0].isToday").value(true)).andReturn();
        return new Stall(read(result, "$.market.id"), read(result, "$.days[0].id"));
    }

    @Test
    void saleAndPickupMarketsAreIndependentAcrossAgendaTrackAndInvoice() throws Exception {
        String staff = login();
        Stall one = openStall(staff, "First stall", 12, 19);
        Stall two = openStall(staff, "Second stall", 12, 21);
        var item = finishedItem();
        item.put("marketDayId", two.dayId());
        item.put("pickupHour", 20.0);

        mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("items", List.of(item)))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("soldOnMarketDayId"));
        mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", dayId(staff, SAT), "items", List.of(item)))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("soldOnMarketDayId"));
        var saved = mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", one.dayId(), "items", List.of(item)))))
                .andExpect(status().isCreated()).andReturn();
        String id = read(saved, "$.id");
        String code = read(saved, "$.code");
        var entity = orderRepository.findById(UUID.fromString(id)).orElseThrow().getOrderItems().getFirst();
        assertThat(entity.getSoldOnDay().getId().toString()).isEqualTo(one.dayId());
        assertThat(entity.getHandoffDay().getId().toString()).isEqualTo(two.dayId());

        mvc.perform(get("/api/orders").param("query", code).header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orders[0].soldAtMarketName").value("First stall"))
                .andExpect(jsonPath("$.orders[0].saleItems[0].kind").value("finished"))
                .andExpect(jsonPath("$.orders[0].saleItems[0].marketOrnamentId").value(entity.getMarketOrnamentId()));
        mvc.perform(get("/api/agenda/days/" + WED).header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.markets[*].id").value(containsInAnyOrder(one.marketId(), two.marketId())))
                .andExpect(jsonPath("$.marketDays[*].id").value(containsInAnyOrder(one.dayId(), two.dayId())))
                .andExpect(jsonPath("$.deliveries[0].marketId").value(two.marketId()))
                .andExpect(jsonPath("$.deliveries[0].marketDayId").value(two.dayId()))
                .andExpect(jsonPath("$.deliveries[0].marketName").value("Second stall"));
        mvc.perform(get("/api/orders/" + id + "/bundle").header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].delivery.marketDayId").value(two.dayId()));
        mvc.perform(withIp(get("/api/track/" + code)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.when.marketName").value("Second stall"))
                .andExpect(jsonPath("$.when.untilHour").value(21.0));

        orders.updatePaymentState(UUID.fromString(id), PaymentState.PAID, PaymentMethod.CARD, null);
        assertThat(invoices.findByOrderIdOrderByNumberAsc(UUID.fromString(id)).getFirst().getBody())
                .contains("Second stall", "20:00").doesNotContain("First stall");
        mvc.perform(delete("/api/market-days/" + one.dayId()).header("Authorization", bearer(staff)))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/market-days/" + two.dayId()).header("Authorization", bearer(staff)))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/markets/" + one.marketId()).header("Authorization", bearer(staff)))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/markets/" + two.marketId()).header("Authorization", bearer(staff)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void overlapPaintingHoursAreDeterministicAndMarketMutationsProtectBookedPaintings() throws Exception {
        String staff = login();
        // Rathausplatz is open on SAT 12:00-19:00. Add "Zeta Stall" on SAT at 12:00-18:00: same open time, so
        // tie-breaker by name ("Rathausplatz" < "Zeta Stall") picks Rathausplatz (closeHour 19.0).
        var createdZeta = mvc.perform(post("/api/markets").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(MarketApiTests.marketBody("Zeta Stall", SAT, 12, 18))))
                .andExpect(status().isOk()).andReturn();
        String earlyMarketId = read(createdZeta, "$.market.id");
        String earlyDayId = read(createdZeta, "$.days[0].id");

        mvc.perform(get("/api/painting-days").param("from", SAT).param("to", SAT).header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].openHour").value(12.0))
                .andExpect(jsonPath("$[0].closeHour").value(19.0));

        // Move Zeta Stall earlier to 10:00-18:00: earliest-opening stall now governs painting hours (10:00-18:00).
        var earlyZeta = new java.util.HashMap<>(MarketApiTests.marketBody("Zeta Stall", SAT, 10, 18));
        earlyZeta.put("id", earlyMarketId);
        mvc.perform(post("/api/markets").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON).content(json(earlyZeta)))
                .andExpect(status().isOk());

        mvc.perform(get("/api/painting-days").param("from", SAT).param("to", SAT).header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].openHour").value(10.0))
                .andExpect(jsonPath("$[0].closeHour").value(18.0));
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", SAT, "durationHours", 1.0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slot.startHour").value(10.0));

        // Setting "paints at" (without an explicit hour override) switches inherited painting hours to that market.
        String rathausMarketId = read(mvc.perform(get("/api/agenda/days/" + SUN).header("Authorization", bearer(staff))).andReturn(), "$.market.id");
        mvc.perform(patch("/api/painting-days/" + SAT).header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("paintingMarketId", rathausMarketId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openHour").value(12.0))
                .andExpect(jsonPath("$.closeHour").value(19.0));
        mvc.perform(patch("/api/painting-days/" + SAT).header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paintingMarketId\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openHour").value(10.0))
                .andExpect(jsonPath("$.closeHour").value(18.0));

        // Book a CUSTOM ornament on the overlap date (SAT 10:00-11:00, picked up at Rathausplatz on SUN).
        String rathausSunDay = dayId(staff, SUN);
        saleOk(staff, customItem(false, SAT, 10.0, 11.0, "market", rathausSunDay, 15.0));
        // A slot outside the effective hours (18:00-19:00, inside Rathausplatz but outside Zeta Stall's 10:00-18:00) is rejected.
        assertThat(sale(staff, customItem(false, SAT, 18.0, 19.0, "market", rathausSunDay, 18.5)).getResponse().getStatus())
                .isEqualTo(400);

        // Editing Zeta Stall to 11:00-18:00 would strand the 10:00-11:00 painting.
        var narrowZeta = new java.util.HashMap<>(MarketApiTests.marketBody("Zeta Stall", SAT, 11, 18));
        narrowZeta.put("id", earlyMarketId);
        mvc.perform(post("/api/markets").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON).content(json(narrowZeta)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("a paint session sits outside 11:00–18:00")));

        // Adding an even earlier stall (09:00-10:00) that would take over effective hours and cut off 10:00-11:00 is rejected.
        mvc.perform(post("/api/markets").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON).content(json(MarketApiTests.marketBody("Dawn Stall", SAT, 9, 10))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("a paint session sits outside 09:00–10:00")));

        // Deleting Zeta Stall (no sales or pickups of its own) would shift effective hours to Rathausplatz (12:00-19:00), stranding 10:00-11:00.
        mvc.perform(delete("/api/market-days/" + earlyDayId).header("Authorization", bearer(staff)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("a paint session sits outside 12:00–19:00")));
        mvc.perform(delete("/api/markets/" + earlyMarketId).header("Authorization", bearer(staff)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("a paint session sits outside 12:00–19:00")));
    }

    @Test
    void sameDaySaleUsesThePickupStallAndChangingPaintingLocationProtectsTheBooking() throws Exception {
        String staff = login();
        Stall gaby = openStall(staff, "Rathausplatz Annex", 12, 19);
        Stall other = openStall(staff, "Spittelberg", 13, 20);
        String rule = "/api/painting-days/" + WED;
        mvc.perform(patch(rule).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("paintingMarketId", gaby.marketId()))))
                .andExpect(status().isOk());
        var wrong = customItem(false, WED, 13.0, 14.0, "market", other.dayId(), 16.0);
        mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", other.dayId(), "items", List.of(wrong)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAINT_NOT_AT_THIS_MARKET"))
                .andExpect(jsonPath("$.message").value("Gaby is painting at Rathausplatz Annex that day. Pick another day."));

        var local = customItem(false, WED, 13.0, 14.0, "market", gaby.dayId(), 16.0);
        mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", other.dayId(), "items", List.of(local)))))
                .andExpect(status().isCreated());

        mvc.perform(patch(rule).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("paintingMarketId", other.marketId()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("1 same-day pickup")));
        mvc.perform(get("/api/agenda/days/" + WED).header("Authorization", bearer(staff)))
                .andExpect(jsonPath("$.paintingMarketId").value(gaby.marketId()));

        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", WED, "durationHours", 1, "handoffMarketDayId", other.dayId()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(false));
        mvc.perform(post("/api/agenda/move-suggestion").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", WED, "handoffDate", WED, "durationHours", 1, "handoffMarketDayId", other.dayId()))))
                .andExpect(status().isNoContent());
    }

    @Test
    void moveAndMoveSuggestionSkipSameDayAtTheOtherPickupStall() throws Exception {
        String staff = login();
        String rathaus = dayId(staff, SAT);
        var other = mvc.perform(post("/api/markets").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(MarketApiTests.marketBody("Spittelberg", SAT, 13, 20))))
                .andExpect(status().isOk()).andReturn();
        String otherDay = read(other, "$.days[0].id");
        String thursday = "2026-11-26";
        String order = saleOk(staff, customItem(false, thursday, 10.0, 11.0, "market", otherDay, 16.0));
        String block = read(mvc.perform(get("/api/agenda/days/" + thursday).header("Authorization", bearer(staff)))
                .andExpect(jsonPath("$.slots[0].order.id").value(order)).andReturn(), "$.slots[0].block.id");

        mvc.perform(patch("/api/agenda/blocks/" + block).header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("date", SAT, "startHour", 13))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAINT_NOT_AT_THIS_MARKET"));

        String friday = "2026-11-27";
        for (String date : List.of(WED, thursday, friday)) {
            // The original block stays on Thursday. Leave only Saturday open for a suggested alternative.
            String body = date.equals(thursday) ? "{\"openHour\":10,\"closeHour\":11}" : "{\"open\":false}";
            mvc.perform(patch("/api/painting-days/" + date).header("Authorization", bearer(staff))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isOk());
        }
        mvc.perform(post("/api/agenda/move-suggestion").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", thursday, "handoffDate", SAT, "durationHours", 1, "handoffMarketDayId", rathaus))))
                .andExpect(status().isNoContent());
    }

    @Test
    void v16BackfillPrefersSoldOnDayThenEarliestOpeningAndNameTieBreaker() throws Exception {
        String staff = login();
        // Two stalls on WED with identical 12:00 open time: low UUID has name "Zeta", high UUID has name "Alpha".
        UUID lowMarket = UUID.fromString("00000000-0000-0000-0000-000000000010");
        UUID lowDay = UUID.fromString("00000000-0000-0000-0000-000000000011");
        UUID highMarket = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffff0010");
        UUID highDay = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffff0011");
        jdbc.update("insert into market (id, kind, name, total_cost, stall) values (?, 'MARKET', 'Zeta Markt', 0, 1)", lowMarket);
        jdbc.update("insert into market_day (id, market_id, date, open_time, close_time) values (?, ?, ?, ?, ?)",
                lowDay, lowMarket, java.time.LocalDate.parse(WED), java.time.LocalTime.of(12, 0), java.time.LocalTime.of(19, 0));
        jdbc.update("insert into market (id, kind, name, total_cost, stall) values (?, 'MARKET', 'Alpha Markt', 0, 2)", highMarket);
        jdbc.update("insert into market_day (id, market_id, date, open_time, close_time) values (?, ?, ?, ?, ?)",
                highDay, highMarket, java.time.LocalDate.parse(WED), java.time.LocalTime.of(12, 0), java.time.LocalTime.of(21, 0));

        var itemSoldAtZeta = finishedItem();
        itemSoldAtZeta.put("marketDayId", lowDay.toString());
        String orderOneId = read(mvc.perform(post("/api/orders").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", lowDay.toString(), "items", List.of(itemSoldAtZeta)))))
                .andExpect(status().isCreated()).andReturn(), "$.id");

        var itemWithoutSoldOn = finishedItem();
        itemWithoutSoldOn.put("marketDayId", highDay.toString());
        String orderTwoId = read(mvc.perform(post("/api/orders").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", highDay.toString(), "items", List.of(itemWithoutSoldOn)))))
                .andExpect(status().isCreated()).andReturn(), "$.id");

        orderRepository.flush();
        jdbc.update("update order_item set handoff_day_id = null where order_id = ?", UUID.fromString(orderOneId));
        jdbc.update("update order_item set handoff_day_id = null, sold_on_day_id = null where order_id = ?", UUID.fromString(orderTwoId));

        String v16 = new String(getClass().getResourceAsStream("/db/migration/V16__handoff_market_day.sql").readAllBytes());
        String updateSql = java.util.Arrays.stream(v16.split(";"))
                .map(String::trim)
                .filter(s -> s.startsWith("--") || s.startsWith("UPDATE"))
                .findFirst().orElseThrow();
        jdbc.update(updateSql);

        assertThat(jdbc.queryForObject("select handoff_day_id from order_item where order_id = ?", UUID.class, UUID.fromString(orderOneId)))
                .isEqualTo(lowDay);
        assertThat(jdbc.queryForObject("select handoff_day_id from order_item where order_id = ?", UUID.class, UUID.fromString(orderTwoId)))
                .isEqualTo(highDay);
    }

    @Test
    void paintingLocationIsNullableAndLeavesSharedHoursAndBookingsAlone() throws Exception {
        String staff = login();
        Stall one = openStall(staff, "First stall", 12, 19);
        Stall two = openStall(staff, "Second stall", 13, 21);
        String path = "/api/painting-days/" + WED;
        mvc.perform(patch(path).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("open", false, "openHour", 10, "closeHour", 13, "paintingMarketId", one.marketId()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketId").value(one.marketId()));
        mvc.perform(patch(path).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("paintingMarketId", two.marketId()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketName").value("Second stall"))
                .andExpect(jsonPath("$.open").value(false)).andExpect(jsonPath("$.openHour").value(10.0))
                .andExpect(jsonPath("$.maxPaintings").value(3));
        mvc.perform(patch(path).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"open\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketName").value("Second stall"));
        mvc.perform(get("/api/agenda/days/" + WED).header("Authorization", bearer(staff)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketName").value("Second stall"));
        mvc.perform(patch(path).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paintingMarketId\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketId").isEmpty());
        mvc.perform(patch(path).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("paintingMarketId", UUID.randomUUID()))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("paintingMarketId"));
        mvc.perform(patch(path).header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("paintingMarketId", one.marketId()))))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/market-days/" + one.dayId()).header("Authorization", bearer(staff)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/agenda/days/" + WED).header("Authorization", bearer(staff)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketId").isEmpty());
    }

    @Test
    void salesFilterByMarketAndTotalCardAndCashAcrossEveryPage() throws Exception {
        String staff = login();
        Stall one = openStall(staff, "Totals stall one", 12, 19);
        Stall two = openStall(staff, "Totals stall two", 12, 21);
        java.util.function.BiFunction<String, PaymentMethod, String> sell = (dayId, method) -> {
            try {
                var saved = mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", dayId, "items", List.of(finishedItem()))))).andExpect(status().isCreated()).andReturn();
                var order = orderRepository.findById(UUID.fromString(read(saved, "$.id"))).orElseThrow();
                order.setPaymentState(PaymentState.PAID);
                order.setAmountPaid(new java.math.BigDecimal("35.00"));
                order.setPaymentMethod(method);
                orderRepository.saveAndFlush(order);
                return order.getId().toString();
            } catch (Exception e) { throw new RuntimeException(e); }
        };
        sell.apply(one.dayId(), PaymentMethod.CARD);
        sell.apply(one.dayId(), PaymentMethod.CASH);
        sell.apply(one.dayId(), PaymentMethod.CASH);
        String cancelled = sell.apply(one.dayId(), PaymentMethod.CARD);
        orderRepository.findById(UUID.fromString(cancelled)).orElseThrow().setStatus("CANCELLED");
        orderRepository.flush();
        sell.apply(two.dayId(), PaymentMethod.CARD);
        // A deposit at stall one: 20 of its total received in cash, the rest is due.
        var deposit = orderRepository.findById(UUID.fromString(sell.apply(one.dayId(), PaymentMethod.CASH))).orElseThrow();
        deposit.setPaymentState(PaymentState.DEPOSIT);
        deposit.setAmountPaid(new java.math.BigDecimal("20.00"));
        java.math.BigDecimal depositDue = deposit.getTotal().subtract(new java.math.BigDecimal("20.00"));
        orderRepository.saveAndFlush(deposit);

        // Page size 1: the totals still cover all matching sales, not only the visible page.
        mvc.perform(get("/api/orders").param("market", one.marketId()).param("size", "1").header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.orders.length()").value(1))
                .andExpect(jsonPath("$.received.card").value(35.0))
                .andExpect(jsonPath("$.received.cash").value(90.0))
                .andExpect(jsonPath("$.received.other").value(0))
                .andExpect(jsonPath("$.received.due").value(depositDue.doubleValue()));
        mvc.perform(get("/api/orders").param("market", two.marketId()).header("Authorization", bearer(staff)))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.orders[0].soldAtMarketName").value("Totals stall two"))
                .andExpect(jsonPath("$.received.card").value(35.0))
                .andExpect(jsonPath("$.received.cash").value(0));
        mvc.perform(get("/api/orders").param("market", "not-a-uuid").header("Authorization", bearer(staff)))
                .andExpect(status().isBadRequest());
    }
}
