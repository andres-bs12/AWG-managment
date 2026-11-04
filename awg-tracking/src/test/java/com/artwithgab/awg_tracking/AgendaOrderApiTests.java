package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AgendaOrderApiTests extends ApiTestSupport {

    private String blockIdOf(String token, String orderId) throws Exception {
        MvcResult res = mvc.perform(get("/api/orders/" + orderId + "/bundle").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andReturn();
        return read(res, "$.blocks[0].id");
    }

    private void moveBlock(String token, String blockId, String date, double start, int expected) throws Exception {
        mvc.perform(patch("/api/agenda/blocks/" + blockId).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("date", date, "startHour", start))))
                .andExpect(status().is(expected));
    }

    @Test
    void capacitySuggestsFirstFreeSlotAfterExistingBlock() throws Exception {
        String token = login();
        Map<String, Object> req = Map.of("date", TUE, "durationHours", 1.0);
        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.slot.startHour").value(10.0));

        saleOk(token, customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.0));

        mvc.perform(post("/api/agenda/capacity").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.slot.startHour").value(11.25));
    }

    @Test
    void moveBlockSucceedsAndOverlapIs409() throws Exception {
        String token = login();
        String sat = dayId(token, SAT);
        saleOk(token, customItem(true, TUE, 10.0, 11.25, "market", sat, 14.0));
        String orderB = saleOk(token, customItem(true, TUE, 11.5, 12.75, "market", sat, 14.0));
        String blockB = blockIdOf(token, orderB);

        moveBlock(token, blockB, TUE, 10.5, 409); // overlaps the first block
        moveBlock(token, blockB, WED, 10.0, 204); // free on Wednesday, 10:00-11:15

        mvc.perform(get("/api/agenda/days/" + WED).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slots[0].block.startHour").value(10.0));
    }

    @Test
    void moveSuggestionReturns204WhenNothingToMove() throws Exception {
        String token = login();
        mvc.perform(post("/api/agenda/move-suggestion").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", TUE, "durationHours", 1.0, "handoffDate", SAT))))
                .andExpect(status().isNoContent());
    }

    @Test
    void unfinishingAnItemUndoesHandedOver() throws Exception {
        String token = login();
        String order = saleOk(token, finishedItem());
        String itemId = this.<String>read(mvc.perform(get("/api/orders/" + order + "/bundle")
                .header("Authorization", bearer(token))).andReturn(), "$.items[0].id");

        mvc.perform(patch("/api/orders/" + order + "/handed-over").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true))))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/orders/" + order).header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.handedOver").value(true));

        mvc.perform(patch("/api/orders/" + order + "/items/" + itemId + "/status").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("status", "in_progress"))))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/orders/" + order).header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.handedOver").value(false));
    }

    @Test
    void handedOverBeforeFinishingIs409() throws Exception {
        String token = login();
        String order = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        mvc.perform(patch("/api/orders/" + order + "/handed-over").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Finish all ornaments before marking handed over"));
    }

    @Test
    void paymentStateUpdate() throws Exception {
        String token = login();
        String order = saleOk(token, finishedItem());
        mvc.perform(patch("/api/orders/" + order + "/payment-state").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("state", "deposit", "method", "cash"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentState").value("deposit"))
                .andExpect(jsonPath("$.paymentMethod").value("cash"));
        mvc.perform(patch("/api/orders/" + order + "/payment-state").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("state", "unpaid"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentState").value("unpaid"));
        assertEquals(1, 1);
    }
}
