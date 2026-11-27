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

/** Sunday 29 Nov 2026: both markets close; at FRANCIS same-day painting and pickup still works. */
@TestPropertySource(properties = {
        "awg.test.clock=2026-11-29T09:00:00Z", // Sun 29 Nov, 10:00 Vienna
        "spring.datasource.url=jdbc:h2:mem:awgSplitSunday;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
})
class SplitWeekendSundayTests extends SplitWeekendSupport {
    @Test
    void sundaySaleAtFrancisIsPaintedAndHandedOverTheSameDayButNotAtBaden() throws Exception {
        String staff = login();
        Stall[] stalls = prodWeekend(staff);
        Stall baden = stalls[0];
        Stall francis = stalls[1];
        // Automatic already resolves Sunday to FRANCIS (opens 11:00, Baden 12:30); set it anyway, as documented.
        paintsAt(staff, SUN, francis.marketId());

        String francisSun = francis.dayIds().get(SUN);
        MvcResult francisSunday = sell(staff, francisSun, customItem(false, SUN, 11.0, 12.0, "market", francisSun, 15.0));
        org.assertj.core.api.Assertions.assertThat(francisSunday.getResponse().getStatus())
                .as(francisSunday.getResponse().getContentAsString()).isEqualTo(201);

        String badenSun = baden.dayIds().get(SUN);
        mvc.perform(post("/api/orders").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("soldOnMarketDayId", badenSun,
                                "items", List.of(customItem(false, SUN, 12.0, 13.0, "market", badenSun, 16.0))))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAINT_NOT_AT_THIS_MARKET"));
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", SUN, "durationHours", 1, "handoffMarketDayId", francisSun))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
    }
}
