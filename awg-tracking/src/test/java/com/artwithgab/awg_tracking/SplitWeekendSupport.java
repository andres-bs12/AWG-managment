package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Production markets of the 27–29 Nov 2026 weekend: Kurpark Baden (Andres) and FRANCIS (Gaby). */
abstract class SplitWeekendSupport extends ApiTestSupport {
    protected static final String FRI = "2026-11-27";

    protected record Stall(String marketId, Map<String, String> dayIds) {}

    protected Stall market(String token, String name, List<Map<String, Object>> days) throws Exception {
        MvcResult res = mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", name, "startDate", FRI, "finishDate", SUN,
                                "totalCost", 300, "stall", 1, "days", days))))
                .andExpect(status().isOk()).andReturn();
        Map<String, String> ids = new LinkedHashMap<>();
        List<Map<String, Object>> saved = read(res, "$.days");
        for (Map<String, Object> d : saved) ids.put((String) d.get("date"), (String) d.get("id"));
        return new Stall(read(res, "$.market.id"), ids);
    }

    protected static Map<String, Object> day(String date, double open, double close) {
        return Map.of("date", date, "openHour", open, "closeHour", close);
    }

    /** Only the two real markets: drop the demo market so automatic choices match production. */
    protected Stall[] prodWeekend(String token) throws Exception {
        List<String> demo = read(mvc.perform(get("/api/markets").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andReturn(), "$[?(@.name=='Rathausplatz')].id");
        for (String id : demo) {
            mvc.perform(delete("/api/markets/" + id).header("Authorization", bearer(token))).andExpect(status().is2xxSuccessful());
        }
        Stall baden = market(token, "Weihnachtsmarkt Kurpark Baden",
                List.of(day(FRI, 14.5, 20.5), day(SAT, 12.5, 20.5), day(SUN, 12.5, 20.5)));
        Stall francis = market(token, "Weihnachtsquartier – FRANCIS",
                List.of(day(FRI, 15, 20), day(SAT, 11, 20), day(SUN, 11, 18)));
        return new Stall[]{baden, francis};
    }

    protected MvcResult sell(String token, String soldOnDayId, Map<String, Object> item) throws Exception {
        return mvc.perform(post("/api/orders").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("soldOnMarketDayId", soldOnDayId, "items", List.of(item))))).andReturn();
    }

    protected void paintsAt(String token, String date, String marketId) throws Exception {
        mvc.perform(patch("/api/painting-days/" + date).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("paintingMarketId", marketId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketId").value(marketId));
    }

}
