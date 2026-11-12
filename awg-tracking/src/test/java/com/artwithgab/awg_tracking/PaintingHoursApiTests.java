package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Painting overrides belong to the painting calendar, never to the market pickup schedule. */
class PaintingHoursApiTests extends ApiTestSupport {
    @Test
    void missingOverridesUsePreferredDayHours() throws Exception {
        String token = login();
        mvc.perform(get("/api/painting-days").param("from", TUE).param("to", TUE)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].openHour").value(10.0))
                .andExpect(jsonPath("$[0].closeHour").value(13.0));
        mvc.perform(get("/api/painting-days").param("from", SAT).param("to", SAT)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].openHour").value(12.0))
                .andExpect(jsonPath("$[0].closeHour").value(19.0));
    }

    @Test
    void changingHoursPreservesBookingsAndAutomaticPlanningUsesNewWindow() throws Exception {
        String token = login();
        String orderId = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        mvc.perform(patch("/api/painting-days/" + TUE).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("open", true, "maxPaintings", 4, "openHour", 11.5, "closeHour", 12.5))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.booked").value(1))
                .andExpect(jsonPath("$.openHour").value(11.5)).andExpect(jsonPath("$.closeHour").value(12.5));
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", TUE, "durationHours", 1))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.slot.startHour").value(11.5))
                .andExpect(jsonPath("$.slot.endHour").value(12.5));
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", TUE, "durationHours", 1.25))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(false));
        mvc.perform(get("/api/agenda/days/" + TUE).header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.marketDay.openHour").value(10.0))
                .andExpect(jsonPath("$.slots[0].order.id").value(orderId))
                .andExpect(jsonPath("$.slots[0].block.startHour").value(10.0));
    }

    @Test
    void paintingExtensionDoesNotChangeMarketPickupHours() throws Exception {
        String token = login();
        mvc.perform(patch("/api/painting-days/" + SAT).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("open", true, "maxPaintings", 4, "openHour", 8.25, "closeHour", 20.0))))
                .andExpect(status().isOk());
        mvc.perform(get("/api/market-days").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.date=='" + SAT + "')].openHour").value(org.hamcrest.Matchers.contains(12.0)))
                .andExpect(jsonPath("$[?(@.date=='" + SAT + "')].closeHour").value(org.hamcrest.Matchers.contains(19.0)));
        mvc.perform(get("/api/agenda/days/" + SAT).header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.marketDay.openHour").value(12.0))
                .andExpect(jsonPath("$.marketDay.closeHour").value(19.0));
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", SAT, "durationHours", 1))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.slot.startHour").value(8.25));
    }

    @Test
    void capacityOnlyEditsKeepExistingHours() throws Exception {
        String token = login();
        mvc.perform(patch("/api/painting-days/" + TUE).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("open", true, "maxPaintings", 4, "openHour", 9.25, "closeHour", 14.75))))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/painting-days/" + TUE).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("open", false, "maxPaintings", 0))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.openHour").value(9.25))
                .andExpect(jsonPath("$.closeHour").value(14.75));
    }

    @Test
    void manualSaleUsesPaintingHoursAndKeepsGabyCapacityOverride() throws Exception {
        String token = login();
        String pickupDay = dayId(token, SAT);
        mvc.perform(patch("/api/painting-days/" + SAT).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("open", false, "maxPaintings", 0, "openHour", 8.25, "closeHour", 11.25))))
                .andExpect(status().isOk());
        // Manual placement can override the automatic capacity switch, within Gaby's hours.
        saleOk(token, customItem(false, SAT, 9.0, 10.0, "market", pickupDay, 14.0));
        var outside = sale(token, customItem(false, SAT, 11.0, 12.0, "market", pickupDay, 14.0));
        org.assertj.core.api.Assertions.assertThat(outside.getResponse().getStatus()).isEqualTo(400);
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", SAT, "durationHours", 1))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(false));
    }

    @Test
    void hoursMustBePairedFiniteQuarterHoursWithEndAfterStart() throws Exception {
        String token = login();
        for (String hours : new String[]{
                "\"openHour\":9", "\"closeHour\":13", "\"openHour\":-0.25,\"closeHour\":13",
                "\"openHour\":10,\"closeHour\":10", "\"openHour\":13,\"closeHour\":10",
                "\"openHour\":10.1,\"closeHour\":13", "\"openHour\":10,\"closeHour\":24.25",
                "\"openHour\":10,\"closeHour\":24",
                "\"openHour\":\"NaN\",\"closeHour\":13"
        }) {
            mvc.perform(patch("/api/painting-days/" + TUE).header("Authorization", bearer(token))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"open\":true,\"maxPaintings\":2," + hours + "}"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void hoursRequireStaffAuthentication() throws Exception {
        mvc.perform(get("/api/painting-days").param("from", TUE).param("to", TUE))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/painting-days/" + TUE).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("open", true, "maxPaintings", 2, "openHour", 10, "closeHour", 13))))
                .andExpect(status().isUnauthorized());
    }
}
