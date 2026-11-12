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
        assertThat(dates).isNotEmpty().contains("2026-11-27", "2026-11-28");
        assertThat(dates).allSatisfy(d -> assertThat(LocalDate.parse(d)).isBetween(LocalDate.of(2026, 11, 27), LocalDate.of(2026, 12, 21)));
        List<String> names = read(res, "$[*].marketName");
        assertThat(names).allSatisfy(n -> assertThat(n).isNotBlank());
        List<String> open = read(res, "$[*].openTime");
        assertThat(open).allSatisfy(t -> assertThat(t).isEqualTo("12:00"));
    }

    @Test
    void pickupOrderHasNoAddressNoFeeAndTheArrivalTime() throws Exception {
        MvcResult res = checkout("2026-11-28", "15:30", null);
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        var order = orderRepository.findByCodeIgnoreCase(read(res, "$.orderCode")).orElseThrow();
        assertThat(order.getDeliveryAddress()).isNull();
        assertThat(order.getDeliveryFee()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(order.getOrderItems()).singleElement().satisfies(item -> {
            assertThat(item.getDeliveryKind()).isEqualTo(DeliveryKind.MARKET);
            assertThat(item.getHandoffDate()).isEqualTo(LocalDate.of(2026, 11, 28));
            assertThat(item.getPickUpTime()).isEqualTo(LocalTime.of(15, 30));
            assertThat(item.getPaintEnd().toLocalDate()).isBefore(LocalDate.of(2026, 11, 28));
        });
    }

    @Test
    void pickupTimeMustBeOnTheHalfHourWhileTheStallIsOpen() throws Exception {
        for (String time : new String[] {"11:30", "18:45", "19:00", "15:10"}) {
            MvcResult res = checkout("2026-11-28", time, null);
            assertThat(res.getResponse().getStatus()).as(time).isEqualTo(400);
            assertThat(res.getResponse().getContentAsString()).contains("PICKUP_TIME_INVALID");
        }
        assertThat(checkout("2026-11-28", null, null).getResponse().getContentAsString()).contains("PICKUP_TIME_INVALID");
        assertThat(checkout("2026-11-28", "18:30", null).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void pickupNeedsAStallDay() throws Exception {
        // Wed 2 Dec is a delivery day, not a stall day.
        MvcResult res = checkout("2026-12-02", "15:00", null);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(res.getResponse().getContentAsString()).contains("PICKUP_DAY_INVALID");
    }

    @Test
    void viennaDeliveryStillNeedsAnAddress() throws Exception {
        var req = multipart("/api/shop/checkout");
        Map<String, Object> payload = Map.of("customerName", "Eva Gruber", "email", "eva@example.com", "phone", "+43 1 234",
                "deliveryDate", "2026-12-02", "acceptTerms", true,
                "items", List.of(Map.of("kind", "custom", "withName", false, "color", "red", "finish", "shiny", "petName", "Luna",
                        "photos", List.of(Map.of("id", "p0", "name", "luna.jpg")))));
        req.file(new MockMultipartFile("photo-p0", "luna.jpg", "image/jpeg", JPEG));
        req.file(new MockMultipartFile("payload", "", "application/json", json(payload).getBytes()));
        mvc.perform(withIp(req)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("address"));
    }
}
