package com.artwithgab.awg_tracking;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The fixed test clock is Tue 2026-11-24 in Vienna, so every sale below is created that day. */
class StatsApiTests extends ApiTestSupport {

    /** Other suites may leave committed orders on the same frozen day, so assert the change this test makes. */
    @Test void salesTotalsExcludeCancelledOrders() throws Exception {
        String token = login();
        String before = stats(token);
        saleOk(token, customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.0), finishedItem());
        String cancelled = saleOk(token, customItem(false, TUE, 12.0, 13.0, "market", dayId(token, SAT), 15.0));
        mvc.perform(post("/api/orders/" + cancelled + "/cancel").header("Authorization", bearer(token))).andExpect(status().isNoContent());
        String after = stats(token);

        assertEquals(1, delta(before, after, "$.sales.orders"));
        assertEquals(2, delta(before, after, "$.sales.ornaments"));
        assertEquals(1, delta(before, after, "$.sales.custom"));
        assertEquals(1, delta(before, after, "$.sales.finished"));
        assertEquals(1, delta(before, after, "$.sales.withName"));
        assertEquals(1, delta(before, after, "$.sales.cancelled"));
        assertEquals(2, delta(before, after, "$.delivery.market"));
        assertEquals(0, new java.math.BigDecimal("102.97").compareTo(
                new java.math.BigDecimal(JsonPath.read(after, "$.sales.revenue").toString())
                        .subtract(new java.math.BigDecimal(JsonPath.read(before, "$.sales.revenue").toString()))));
        assertEquals(1, ((Number) JsonPath.read(after, "$.daily.length()")).intValue());
    }

    private String stats(String token) throws Exception {
        return mvc.perform(get("/api/stats").param("from", TUE).param("to", TUE).header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private static int delta(String before, String after, String path) {
        return ((Number) JsonPath.read(after, path)).intValue() - ((Number) JsonPath.read(before, path)).intValue();
    }

    @Test void pageViewsAndFunnelCountAnonymousEvents() throws Exception {
        String token = login();
        String before = stats(token);
        for (String event : new String[]{"home_view", "home_view", "track_view", "form_view", "buy_view", "buy_pay_click"}) {
            mvc.perform(withIp(post("/api/metrics/buy")).contentType(MediaType.APPLICATION_JSON).content(json(Map.of("event", event))))
                    .andExpect(status().isNoContent());
        }
        mvc.perform(withIp(post("/api/metrics/buy")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("event", "buy_step", "step", "delivery")))).andExpect(status().isNoContent());
        String after = stats(token);

        assertEquals(2, delta(before, after, "$.web.homeViews"));
        assertEquals(1, delta(before, after, "$.web.trackViews"));
        assertEquals(1, delta(before, after, "$.web.formViews"));
        assertEquals(1, delta(before, after, "$.web.funnel[0].count"));
        assertEquals(1, delta(before, after, "$.web.funnel[1].count"));
        assertEquals(1, delta(before, after, "$.web.funnel[3].count"));
        assertEquals("pay_click", JsonPath.read(after, "$.web.funnel[3].stage"));
        assertEquals(5, delta(before, after, "$.daily[0].visits"));
    }

    @Test void statsAreStaffOnlyAndRangeIsBounded() throws Exception {
        mvc.perform(withIp(get("/api/stats")).param("from", TUE).param("to", TUE)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/stats").param("from", "2026-01-01").param("to", "2027-12-31").header("Authorization", bearer(login())))
                .andExpect(status().isBadRequest());
    }
}
