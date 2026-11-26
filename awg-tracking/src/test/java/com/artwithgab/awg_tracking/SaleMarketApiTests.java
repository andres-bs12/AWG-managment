package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Moving a past stall sale to the market it happened at (Sat 28 Nov 2026, demo stall open). */
@TestPropertySource(properties = {
        "awg.test.clock=2026-11-28T12:00:00Z",
        "spring.datasource.url=jdbc:h2:mem:awgSaleMarket;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"
})
class SaleMarketApiTests extends ApiTestSupport {

    @Test
    void staffMoveASaleToAnotherMarketOpenThatDay() throws Exception {
        String token = login();
        String id = saleOk(token, finishedItem());
        mvc.perform(get("/api/orders/" + id).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.soldAtMarketName").value("Rathausplatz"));

        // The real market is loaded after the sale.
        var other = mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(MarketApiTests.marketBody("Other Markt", SAT, 10, 20))))
                .andExpect(status().isOk()).andReturn();
        String otherDay = read(other, "$.days[0].id");

        mvc.perform(patch("/api/orders/" + id + "/market").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("marketDayId", otherDay))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.soldOnMarketDayId").value(otherDay))
                .andExpect(jsonPath("$.soldAtMarketName").value("Other Markt"));
        // The sales list counts it for the new market too.
        mvc.perform(get("/api/orders/" + id).header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.soldAtMarketName").value("Other Markt"));
    }

    @Test
    void onlyAStallMarketOnTheSaleDayCanBeChosen() throws Exception {
        String token = login();
        String id = saleOk(token, finishedItem());
        mvc.perform(patch("/api/orders/" + id + "/market").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("marketDayId", dayId(token, SUN)))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("marketDayId"));
        mvc.perform(patch("/api/orders/" + id + "/market").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("marketDayId", java.util.UUID.randomUUID().toString()))))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/orders/" + id + "/market")
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("marketDayId", dayId(token, SAT)))))
                .andExpect(status().isUnauthorized());
    }
}
