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
    void savingMarketHoursThatExcludeExistingPickupIs400() throws Exception {
        String token = login();
        // Order picked up Sat 28 Nov 14:00 at Rathausplatz; a new market claiming that date is refused.
        saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        Map<String, Object> body = Map.of("name", "Other Markt", "startDate", "2026-11-27", "finishDate", "2026-11-30",
                "totalCost", 100, "stall", 4,
                "days", List.of(Map.of("date", SAT, "openHour", 9.0, "closeHour", 12.0)));
        mvc.perform(post("/api/markets").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isBadRequest());
    }
}
