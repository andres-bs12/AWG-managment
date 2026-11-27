package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.payment.StripeClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * Web pickups on the production weekend (owner, 2026-11-27: "si se puede recoger ya, si Gaby está"). Gaby paints
 * at FRANCIS; a web order is always painted on an earlier day, so it can be picked up at FRANCIS or taken to
 * Baden. Ordered on Friday, painting starts Saturday, so Sunday is the first pickup day, at either stall.
 */
@TestPropertySource(properties = {
        "awg.shop.enabled=true",
        "awg.test.clock=2026-11-27T08:00:00Z", // Fri 27 Nov, 09:00 Vienna
        "spring.datasource.url=jdbc:h2:mem:awgSplitWebPickup;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
})
class SplitWeekendWebPickupTests extends SplitWeekendSupport {
    @MockitoBean
    StripeClient stripe;
    @Autowired
    OrderRepository orders;

    @Test
    void sundayIsOfferedAtBothStallsAndABadenPickupIsPaintedTheDayBefore() throws Exception {
        when(stripe.isConfigured()).thenReturn(true);
        when(stripe.createCheckoutSession(anyString(), anyString(), anyString(), anyList(), any()))
                .thenReturn(new StripeClient.Session("cs_test_split", "https://checkout.stripe.test/cs_test_split"));
        String staff = login();
        Stall[] stalls = prodWeekend(staff);
        Stall baden = stalls[0];
        Stall francis = stalls[1];
        for (String date : List.of(FRI, SAT, SUN)) paintsAt(staff, date, francis.marketId());

        MvcResult list = mvc.perform(withIp(post("/api/shop/pickup-days")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("items", List.of(Map.of("kind", "custom", "withName", false)))))).andReturn();
        assertThat(list.getResponse().getStatus()).isEqualTo(200);
        assertThat(this.<List<String>>read(list, "$[*].date")).doesNotContain(FRI, SAT);
        assertThat(this.<List<String>>read(list, "$[?(@.date=='" + SUN + "')].marketDayId"))
                .containsExactlyInAnyOrder(baden.dayIds().get(SUN), francis.dayIds().get(SUN));

        String badenSun = baden.dayIds().get(SUN);
        Map<String, Object> payload = new HashMap<>(Map.of("customerName", "Eva Gruber", "email", "eva@example.com", "phone", "+43 1 234",
                "deliveryDate", SUN, "deliveryKind", "market", "marketDayId", badenSun, "pickupTime", "15:00", "acceptTerms", true,
                "items", List.of(Map.of("kind", "custom", "size", "big", "withName", false, "color", "red", "finish", "shiny",
                        "photos", List.of(Map.of("id", "p0", "name", "luna.jpg"))))));
        var req = multipart("/api/shop/checkout");
        req.file(new MockMultipartFile("photo-p0", "luna.jpg", "image/jpeg", TestImages.jpeg()));
        req.file(new MockMultipartFile("payload", "", "application/json", json(payload).getBytes()));
        MvcResult res = mvc.perform(withIp(req)).andReturn();
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(200);
        var item = orders.findByCodeIgnoreCase(read(res, "$.orderCode")).orElseThrow().getOrderItems().getFirst();
        assertThat(item.getHandoffDay().getId().toString()).isEqualTo(badenSun);
        assertThat(item.getPaintStart().toLocalDate()).isEqualTo(LocalDate.parse(SAT));
    }
}
