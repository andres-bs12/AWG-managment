package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MarketApiTests extends ApiTestSupport {

    @Test
    void savingMarketWithMondayIs400() throws Exception {
        String token = login();
        Map<String, Object> body = Map.of("name", "Test Markt", "startDate", "2027-01-01", "finishDate", "2027-01-10",
                "totalCost", 100, "stall", 3,
                "days", List.of(Map.of("date", "2027-01-04", "openHour", 12.0, "closeHour", 18.0))); // Monday
        mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("is not a Friday, Saturday, or Sunday")));
    }

    @Test
    void savingMarketWithValidDaysWorks() throws Exception {
        String token = login();
        Map<String, Object> body = Map.of("name", "Test Markt", "startDate", "2027-01-01", "finishDate", "2027-01-10",
                "totalCost", 100, "stall", 3,
                "days", List.of(Map.of("date", "2027-01-02", "openHour", 12.0, "closeHour", 18.0))); // Saturday
        mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.days.length()").value(1));
    }

    @Test
    void deletingMarketDayWithOrdersIs400() throws Exception {
        String token = login();
        String sat = dayId(token, SAT);
        saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", sat, 14.0));
        mvc.perform(delete("/api/market-days/" + sat).header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("has orders and cannot be deleted")));
    }

    @Test
    void pickupHoursAndDeletionAreSpecificToTheStall() throws Exception {
        String token = login();
        var booked = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/agenda/days/" + SAT)
                        .header("Authorization", bearer(token))).andExpect(status().isOk()).andReturn();
        String bookedMarket = read(booked, "$.market.id");
        String bookedDay = read(booked, "$.marketDay.id");
        saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", bookedDay, 14.0));

        var second = mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(marketBody("Other Markt", SAT, 9, 12))))
                .andExpect(status().isOk()).andReturn();
        String secondDay = read(second, "$.days[0].id");

        var change = new java.util.HashMap<>(marketBody("Rathausplatz", SAT, 9, 12));
        change.put("id", bookedMarket);
        change.put("finishDate", "2026-12-21");
        mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(change)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("a pickup at 14:00")));
        mvc.perform(delete("/api/market-days/" + secondDay).header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
    }

    static Map<String, Object> marketBody(String name, String date, int open, int close) {
        return Map.of("name", name, "startDate", "2026-11-25", "finishDate", "2026-11-29",
                "totalCost", 100, "stall", 4,
                "days", List.of(Map.of("date", date, "openHour", open, "closeHour", close)));
    }
}
