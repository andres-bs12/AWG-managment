package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.repository.OrderItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "awg.test.clock=2026-11-25T14:31:00Z",
        "spring.datasource.url=jdbc:h2:mem:awgEarlyPainting;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"
})
class EarlyPaintingApiTests extends ApiTestSupport {
    @Autowired OrderItemRepository items;

    @Test
    void finishingBeforeStartFreesAnEntireSlotEvenAtTheDailyLimit() throws Exception {
        String token = login();
        setHours(token, 17, 18);
        String order = saleOk(token, customItem(false, WED, 17.0, 18.0, "market", dayId(token, SAT), 14.0));
        String item = itemId(token, order);
        checkCapacity(token, false);

        changeStatus(token, order, item, "finished");
        assertBlock(token, order, 15.5, 15.75);
        changeStatus(token, order, item, "finished");
        assertBlock(token, order, 15.5, 15.75);
        checkCapacity(token, true);
        saleOk(token, customItem(false, WED, 17.0, 18.0, "market", dayId(token, SAT), 14.0));

        changeStatus(token, order, item, "not_started");
        assertBlock(token, order, 15.5, 15.75);
    }

    @Test
    void finishingDuringTheSessionRoundsTheEndButKeepsItsStart() throws Exception {
        String token = login();
        setHours(token, 15, 18);
        String order = saleOk(token, customItem(false, WED, 15.75, 17.0, "market", dayId(token, SAT), 14.0));
        String item = itemId(token, order);
        items.findById(UUID.fromString(item)).orElseThrow().setPaintStart(LocalDateTime.parse(WED + "T15:00"));

        changeStatus(token, order, item, "finished");
        assertBlock(token, order, 15.0, 15.75);
    }

    @Test
    void finishingOnAnotherDateKeepsTheRecordedInterval() throws Exception {
        String token = login();
        String date = "2026-11-26";
        var sale = customItem(false, date, 10.0, 11.0, "market", dayId(token, SAT), 14.0);
        String order = saleOk(token, sale);
        String item = itemId(token, order);
        changeStatus(token, order, item, "finished");
        assertBlock(token, order, 10.0, 11.0);

        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("date", date, "durationHours", 1.0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slot.startHour").value(10.0))
                .andExpect(jsonPath("$.slot.endHour").value(11.0));
        saleOk(token, sale);

        mvc.perform(patch("/api/orders/" + order + "/items/" + item + "/status").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("status", "not_started"))))
                .andExpect(status().isConflict());
        assertBlock(token, order, 10.0, 11.0);
    }

    private void setHours(String token, int opens, int closes) throws Exception {
        mvc.perform(patch("/api/painting-days/" + WED).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("open", true, "openHour", opens, "closeHour", closes))))
                .andExpect(status().isOk());
    }

    private String itemId(String token, String order) throws Exception {
        return read(mvc.perform(get("/api/orders/" + order + "/bundle").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andReturn(), "$.items[0].id");
    }

    private void changeStatus(String token, String order, String item, String productionStatus) throws Exception {
        mvc.perform(patch("/api/orders/" + order + "/items/" + item + "/status").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("status", productionStatus))))
                .andExpect(status().isNoContent());
    }

    private void assertBlock(String token, String order, double start, double end) throws Exception {
        mvc.perform(get("/api/orders/" + order + "/bundle").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks[0].startHour").value(start))
                .andExpect(jsonPath("$.blocks[0].endHour").value(end));
    }

    private void checkCapacity(String token, boolean available) throws Exception {
        var result = mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("date", WED, "durationHours", 1.0))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(available));
        if (available) result.andExpect(jsonPath("$.slot.startHour").value(17.0)).andExpect(jsonPath("$.slot.endHour").value(18.0));
    }
}
