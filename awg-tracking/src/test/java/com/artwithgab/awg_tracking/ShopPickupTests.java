package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.payment.StripeClient;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Web orders picked up at the stall: stall days with painting time before them, an arrival time
 * while the stall is open, no address and no delivery fee. Demo market Rathausplatz runs
 * Fri 27 Nov - Mon 21 Dec, 12:00-19:00; "today" is Tue 24 Nov 2026.
 */
@TestPropertySource(properties = "awg.shop.enabled=true")
class ShopPickupTests extends ApiTestSupport {
    private static final String DEC_SAT = "2026-12-05";
    private static final byte[] JPEG = TestImages.jpeg();

    @MockitoBean
    StripeClient stripe;
    @Autowired
    OrderRepository orderRepository;

    @BeforeEach
    void stripeOk() {
        when(stripe.isConfigured()).thenReturn(true);
        when(stripe.createCheckoutSession(anyString(), anyString(), anyString(), anyList(), any()))
                .thenReturn(new StripeClient.Session("cs_test_pickup", "https://checkout.stripe.test/cs_test_pickup"));
    }

    private MvcResult pickupDays() throws Exception {
        return mvc.perform(withIp(post("/api/shop/pickup-days")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("items", List.of(Map.of("kind", "custom", "withName", true)))))).andReturn();
    }

    private MvcResult checkout(String date, String time, Map<String, Object> address) throws Exception {
        var req = multipart("/api/shop/checkout");
        Map<String, Object> payload = new HashMap<>(Map.of("customerName", "Eva Gruber", "email", "eva@example.com", "phone", "+43 1 234",
                "deliveryDate", date, "deliveryKind", "market", "acceptTerms", true,
                "items", List.of(Map.of("kind", "custom", "withName", false, "color", "red", "finish", "shiny", "petName", "Luna",
                        "photos", List.of(Map.of("id", "p0", "name", "luna.jpg"))))));
        if (time != null) payload.put("pickupTime", time);
        if (address != null) payload.put("address", address);
        req.file(new MockMultipartFile("photo-p0", "luna.jpg", "image/jpeg", JPEG));
        req.file(new MockMultipartFile("payload", "", "application/json", json(payload).getBytes()));
        return mvc.perform(withIp(req)).andReturn();
    }

    @Test
    void pickupDaysAreStallDaysWithPaintingTimeBefore() throws Exception {
        MvcResult res = pickupDays();
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        List<String> dates = read(res, "$[*].date");
        assertThat(dates).isNotEmpty().contains("2026-12-04", "2026-12-05");
        assertThat(dates).allSatisfy(d -> assertThat(LocalDate.parse(d)).isBetween(LocalDate.of(2026, 11, 30), LocalDate.of(2026, 12, 21)));
        List<String> names = read(res, "$[*].marketName");
        assertThat(names).allSatisfy(n -> assertThat(n).isNotBlank());
        List<String> open = read(res, "$[*].openTime");
        assertThat(open).allSatisfy(t -> assertThat(t).isEqualTo("12:00"));
    }

    @Test
    void openingWeekIsExcludedFromWebHandoffsAndPickupCheckout() throws Exception {
        String staff = login();
        for (String date : List.of(WED, "2026-11-26")) {
            mvc.perform(post("/api/markets").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                            .content(json(MarketApiTests.marketBody("Opening stall " + date, date, 12, 19))))
                    .andExpect(status().isOk());
        }
        List<String> openingWeek = List.of(WED, "2026-11-26", "2026-11-27", SAT, SUN);
        assertThat(this.<List<String>>read(pickupDays(), "$[*].date")).doesNotContainAnyElementsOf(openingWeek);
        for (String date : openingWeek) {
            var result = checkout(date, "15:30", null);
            assertThat(result.getResponse().getStatus()).isEqualTo(400);
            assertThat(this.<String>read(result, "$.code")).isEqualTo("PICKUP_DAY_INVALID");
        }
    }

    @Test
    void pickupOrderHasNoAddressNoFeeAndTheArrivalTime() throws Exception {
        MvcResult res = checkout("2026-12-05", "15:30", null);
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        var order = orderRepository.findByCodeIgnoreCase(read(res, "$.orderCode")).orElseThrow();
        assertThat(order.getDeliveryAddress()).isNull();
        assertThat(order.getDeliveryFee()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(order.getOrderItems()).singleElement().satisfies(item -> {
            assertThat(item.getDeliveryKind()).isEqualTo(DeliveryKind.MARKET);
            assertThat(item.getHandoffDate()).isEqualTo(LocalDate.of(2026, 12, 5));
            assertThat(item.getPickUpTime()).isEqualTo(LocalTime.of(15, 30));
            assertThat(item.getPaintEnd().toLocalDate()).isBefore(LocalDate.of(2026, 12, 5));
        });
    }

    @Test
    void makeRoomCanMoveAWebPickupBlockWithoutChangingThePickup() throws Exception {
        String token = login();
        var checkout = checkout(DEC_SAT, "15:30", null);
        assertThat(checkout.getResponse().getStatus()).isEqualTo(200);
        var order = orderRepository.findByCodeIgnoreCase(read(checkout, "$.orderCode")).orElseThrow();
        var item = order.getOrderItems().getFirst();
        assertThat(item.getPaintStart().toLocalTime()).isEqualTo(LocalTime.NOON);

        mvc.perform(post("/api/agenda/blocks/{id}/make-room", item.getId()).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved[0].to.startHour").value(13.0));
        assertThat(item.getHandoffDate()).isEqualTo(LocalDate.parse(DEC_SAT));
        assertThat(item.getPickUpTime()).isEqualTo(LocalTime.of(15, 30));
    }

    @Test
    void makeRoomRejectsTheOtherStallAndMovesOnlyWithinGabysHours() throws Exception {
        String token = login();
        String friday = "2026-11-27";
        String otherStallDay = dayId(token, friday);
        var market = mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(MarketApiTests.marketBody("Gaby's stall", friday, 15, 17))))
                .andExpect(status().isOk()).andReturn();
        String paintingMarket = read(market, "$.market.id");
        mvc.perform(patch("/api/painting-days/" + friday).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("paintingMarketId", paintingMarket))))
                .andExpect(status().isOk());

        String pickup = dayId(token, SAT);
        UUID orderId = UUID.fromString(saleOk(token, customItem(false, WED, 10.0, 11.0, "market", pickup, 14.0)));
        saleOk(token, customItem(false, WED, 11.0, 12.0, "market", pickup, 14.0));
        var item = orderRepository.findById(orderId).orElseThrow().getOrderItems().getFirst();
        var before = item.getPaintStart();
        mvc.perform(patch("/api/painting-days/2026-11-26").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"open\":false}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/agenda/make-room").header("Authorization", bearer(token))
                        .header("Idempotency-Key", "other-stall").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", friday, "minutes", 60, "marketDayId", otherStallDay))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAINT_NOT_AT_THIS_MARKET"));
        assertThat(item.getPaintStart()).isEqualTo(before);

        mvc.perform(post("/api/agenda/blocks/{id}/make-room", item.getId()).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved[0].to.date").value(friday))
                .andExpect(jsonPath("$.moved[0].to.startHour").value(15.0));
        assertThat(item.getHandoffDay().getId().toString()).isEqualTo(pickup);
    }

    @Test
    void checkoutDoesNotFallBackToPaintingOnThePickupDay() throws Exception {
        String staff = login();
        LocalDate pickup = LocalDate.parse(DEC_SAT);
        for (LocalDate date = pickup.minusDays(7); date.isBefore(pickup); date = date.plusDays(1)) {
            mvc.perform(patch("/api/painting-days/" + date).header("Authorization", bearer(staff))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"open\":false}"))
                    .andExpect(status().isOk());
        }
        assertThat(this.<List<String>>read(pickupDays(), "$[*].date")).doesNotContain(DEC_SAT);
        var result = checkout(DEC_SAT, "15:30", null);
        assertThat(result.getResponse().getStatus()).isEqualTo(409);
        assertThat(this.<String>read(result, "$.code")).isEqualTo("DAY_FULL");
    }

    @Test
    void pickupTimeMustBeOnTheHalfHourWhileTheStallIsOpen() throws Exception {
        for (String time : new String[] {"11:30", "18:45", "19:00", "15:10"}) {
            MvcResult res = checkout("2026-12-05", time, null);
            assertThat(res.getResponse().getStatus()).as(time).isEqualTo(400);
            assertThat(res.getResponse().getContentAsString()).contains("PICKUP_TIME_INVALID");
        }
        assertThat(checkout("2026-12-05", null, null).getResponse().getContentAsString()).contains("PICKUP_TIME_INVALID");
        assertThat(checkout("2026-12-05", "18:30", null).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void pickupNeedsAStallDay() throws Exception {
        // Wed 2 Dec is a delivery day, not a stall day.
        MvcResult res = checkout("2026-12-02", "15:00", null);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(res.getResponse().getContentAsString()).contains("PICKUP_DAY_INVALID");
    }

    @Test
    void pickupDayWithNoHalfHourArrivalIsNotOffered() throws Exception {
        String token = login();
        String date = "2026-12-04";
        mvc.perform(delete("/api/market-days/" + dayId(token, date)).header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        var market = new HashMap<>(MarketApiTests.marketBody("Short arrival window", date, 12, 13));
        market.put("startDate", date);
        market.put("finishDate", date);
        market.put("days", List.of(Map.of("date", date, "openHour", 12.25, "closeHour", 12.75)));
        mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(market)))
                .andExpect(status().isOk());
        assertThat(this.<List<String>>read(pickupDays(), "$[*].date")).doesNotContain(date);
        assertThat(checkout(date, "12:30", null).getResponse().getContentAsString()).contains("PICKUP_DAY_INVALID");
    }

    @Test
    void overlapWithNoPrimaryConfiguredFailsClosed() throws Exception {
        String token = login();
        String rathausSatDay = dayId(token, DEC_SAT);
        var market = new HashMap<>(MarketApiTests.marketBody("Second stall", DEC_SAT, 13, 20));
        market.put("startDate", DEC_SAT);
        market.put("finishDate", DEC_SAT);
        var second = mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(market)))
                .andExpect(status().isOk()).andReturn();
        String secondSatDay = read(second, "$.days[0].id");

        assertThat(this.<List<String>>read(pickupDays(), "$[*].date"))
                .doesNotContain(DEC_SAT)
                .contains("2026-12-04", "2026-12-06");
        for (String marketDayId : Arrays.asList(rathausSatDay, secondSatDay, null)) {
            var req = multipart("/api/shop/checkout");
            Map<String, Object> payload = new HashMap<>(Map.of("customerName", "Eva Gruber", "email", "eva@example.com", "phone", "+43 1 234",
                    "deliveryDate", DEC_SAT, "deliveryKind", "market", "pickupTime", "14:00", "acceptTerms", true,
                    "items", List.of(Map.of("kind", "custom", "withName", false, "color", "red", "finish", "shiny", "petName", "Luna",
                            "photos", List.of(Map.of("id", "p0", "name", "luna.jpg"))))));
            if (marketDayId != null) payload.put("marketDayId", marketDayId);
            req.file(new MockMultipartFile("photo-p0", "luna.jpg", "image/jpeg", JPEG));
            req.file(new MockMultipartFile("payload", "", "application/json", json(payload).getBytes()));
            MvcResult res = mvc.perform(withIp(req)).andReturn();
            assertThat(res.getResponse().getStatus()).isEqualTo(400);
            assertThat(this.<String>read(res, "$.code")).isEqualTo("PICKUP_DAY_INVALID");
        }
    }

    @Test
    void postShippingNeedsAnAddress() throws Exception {
        var req = multipart("/api/shop/checkout");
        Map<String, Object> payload = Map.of("customerName", "Eva Gruber", "email", "eva@example.com", "phone", "+43 1 234",
                "expectedArrivalTo", "2026-12-04", "acceptTerms", true,
                "items", List.of(Map.of("kind", "custom", "withName", false, "color", "red", "finish", "shiny", "petName", "Luna",
                        "photos", List.of(Map.of("id", "p0", "name", "luna.jpg")))));
        req.file(new MockMultipartFile("photo-p0", "luna.jpg", "image/jpeg", JPEG));
        req.file(new MockMultipartFile("payload", "", "application/json", json(payload).getBytes()));
        mvc.perform(withIp(req)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("address"));
    }
}
