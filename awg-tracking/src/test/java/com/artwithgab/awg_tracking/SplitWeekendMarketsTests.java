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

/**
 * Weekend 27–29 Nov 2026 as it is in production: Andres sells at Kurpark Baden while Gaby paints only at
 * FRANCIS. Same markets, days and hours as prod. A personalised piece sold at Baden must never be handed over
 * at Baden on the day it is painted (Gaby is not there), but can be painted at FRANCIS and picked up at Baden
 * on a later day. At FRANCIS same-day painting and pickup keeps working.
 */
@TestPropertySource(properties = {
        "awg.test.clock=2026-11-27T08:00:00Z", // Fri 27 Nov, 09:00 Vienna
        "spring.datasource.url=jdbc:h2:mem:awgSplitWeekend;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
})
class SplitWeekendMarketsTests extends ApiTestSupport {
    private static final String FRI = "2026-11-27";

    private record Stall(String marketId, Map<String, String> dayIds) {}

    private Stall market(String token, String name, List<Map<String, Object>> days) throws Exception {
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

    private static Map<String, Object> day(String date, double open, double close) {
        return Map.of("date", date, "openHour", open, "closeHour", close);
    }

    /** Only the two real markets: drop the demo market so automatic choices match production. */
    private Stall[] prodWeekend(String token) throws Exception {
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

    private MvcResult sell(String token, String soldOnDayId, Map<String, Object> item) throws Exception {
        return mvc.perform(post("/api/orders").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("soldOnMarketDayId", soldOnDayId, "items", List.of(item))))).andReturn();
    }

    private void paintsAt(String token, String date, String marketId) throws Exception {
        mvc.perform(patch("/api/painting-days/" + date).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("paintingMarketId", marketId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.paintingMarketId").value(marketId));
    }

    @Test
    void splitWeekendNeedsGabyPaintsAtFrancisOnFridayAndThenBlocksSameDayAtBaden() throws Exception {
        String staff = login();
        Stall[] stalls = prodWeekend(staff);
        Stall baden = stalls[0];
        Stall francis = stalls[1];

        // 1. As production is now ("Gaby paints at" = Automatic): the earliest stall wins.
        //    Friday Baden opens 14:30, FRANCIS 15:00, so the app believes Gaby paints at Baden on Friday.
        mvc.perform(get("/api/agenda/days/" + FRI).header("Authorization", bearer(staff)))
                .andExpect(jsonPath("$.paintingMarketId").isEmpty())
                .andExpect(jsonPath("$.market.id").value(baden.marketId()));
        for (String date : List.of(SAT, SUN)) {
            mvc.perform(get("/api/agenda/days/" + date).header("Authorization", bearer(staff)))
                    .andExpect(jsonPath("$.market.id").value(francis.marketId()));
        }
        // ...so a personalised same-day pickup at Baden on Friday is accepted today (wrong for this weekend).
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", FRI, "durationHours", 1, "handoffMarketDayId", baden.dayIds().get(FRI)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        // Saturday and Sunday are already right without any setting.
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", SAT, "durationHours", 1, "handoffMarketDayId", baden.dayIds().get(SAT)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(false));

        // 2. The fix is configuration only: Agenda → "Gaby paints at" = FRANCIS on Fri, Sat and Sun.
        for (String date : List.of(FRI, SAT, SUN)) paintsAt(staff, date, francis.marketId());
        mvc.perform(get("/api/agenda/days/" + FRI).header("Authorization", bearer(staff)))
                .andExpect(jsonPath("$.market.id").value(francis.marketId()));
        // Gaby's painting hours follow FRANCIS (Fri 15–20 → up to 5 paintings).
        mvc.perform(get("/api/painting-days").param("from", FRI).param("to", FRI).header("Authorization", bearer(staff)))
                .andExpect(jsonPath("$[0].openHour").value(15.0)).andExpect(jsonPath("$[0].maxPaintings").value(5));

        for (String date : List.of(FRI, SAT, SUN)) {
            // Baden, same day: no automatic slot and the sale is refused.
            mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("date", date, "durationHours", 1, "handoffMarketDayId", baden.dayIds().get(date)))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(false))
                    .andExpect(jsonPath("$.message").value("Gaby is painting at Weihnachtsquartier – FRANCIS that day. Pick another day."));
            mvc.perform(post("/api/agenda/move-suggestion").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("date", date, "handoffDate", date, "durationHours", 1,
                                    "handoffMarketDayId", baden.dayIds().get(date)))))
                    .andExpect(status().isNoContent());
            // FRANCIS, same day: still offered.
            mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("date", date, "durationHours", 1, "handoffMarketDayId", francis.dayIds().get(date)))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        }

        String badenFri = baden.dayIds().get(FRI);
        // Personalised, sold at Baden, picked up at Baden the same day → refused.
        mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", badenFri,
                                "items", List.of(customItem(false, FRI, 15.0, 16.0, "market", badenFri, 19.0))))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAINT_NOT_AT_THIS_MARKET"));
        // Personalised, sold at Baden on Friday, painted at FRANCIS on Friday, picked up at Baden on Saturday → OK.
        MvcResult later = sell(staff, badenFri, customItem(false, FRI, 15.0, 16.0, "market", baden.dayIds().get(SAT), 14.0));
        org.assertj.core.api.Assertions.assertThat(later.getResponse().getStatus())
                .as(later.getResponse().getContentAsString()).isEqualTo(201);
        // Personalised, sold and picked up at FRANCIS the same day → OK.
        MvcResult francisSameDay = sell(staff, francis.dayIds().get(FRI),
                customItem(false, FRI, 16.0, 17.0, "market", francis.dayIds().get(FRI), 19.0));
        org.assertj.core.api.Assertions.assertThat(francisSameDay.getResponse().getStatus())
                .as(francisSameDay.getResponse().getContentAsString()).isEqualTo(201);
        // A ready-made (non-personalised) piece at Baden is not affected.
        var ready = finishedItem();
        ready.put("marketDayId", badenFri);
        MvcResult walkIn = sell(staff, badenFri, ready);
        org.assertj.core.api.Assertions.assertThat(walkIn.getResponse().getStatus())
                .as(walkIn.getResponse().getContentAsString()).isEqualTo(201);

        // Once a pickup at FRANCIS is booked, nobody can switch Friday back to Baden by mistake.
        mvc.perform(patch("/api/painting-days/" + FRI).header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("paintingMarketId", baden.marketId()))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAINT_NOT_AT_THIS_MARKET"));
    }
}
