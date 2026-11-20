package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Owner, 2026-11-20: Post ornaments are painted from Wed 25 Nov 2026, with no separate collection floor. */
@TestPropertySource(properties = {"awg.post.collection-from=", "awg.post.paint-from=2026-11-25"})
class PostPaintFloorTests extends ApiTestSupport {

    @Test
    void webQuoteNeverPaintsBeforeTheFloor() throws Exception {
        // Clock: Tue 24 Nov. Painting starts Wed 25 Nov at the earliest → collection Fri 27 Nov → Tue 1 – Wed 2 Dec.
        mvc.perform(withIp(post("/api/shop/shipping-quote")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("items", List.of(Map.of("kind", "custom", "withName", false))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionDate").value("2026-11-27"))
                .andExpect(jsonPath("$.arrivalFrom").value("2026-12-01"))
                .andExpect(jsonPath("$.arrivalTo").value("2026-12-02"));
    }

    @Test
    void staffWindowStartsAtTheFloorToo() throws Exception {
        mvc.perform(post("/api/shipping/window").header("Authorization", bearer(login()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"readyOn\":\"2026-11-24\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionDate").value("2026-11-27"));
    }
}
