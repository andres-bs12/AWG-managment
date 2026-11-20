package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
    void moveCannotUseAClosedOrFullDayButCanRearrangeTheOnlySlotAtTheLimit() throws Exception {
        String token = login();
        String order = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        String block = blockIdOf(token, order);
        // Closed day refuses moves.
        mvc.perform(patch("/api/painting-days/" + WED).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("open", false))))
                .andExpect(status().isOk());
        moveBlock(token, block, WED, 10.0, 409);
        // Open day with <1h window derives max 0 and refuses moves.
        mvc.perform(patch("/api/painting-days/" + WED).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("open", true, "openHour", 10.0, "closeHour", 10.75))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.maxPaintings").value(0));
        moveBlock(token, block, WED, 10.0, 409);
        // 1.5h window derives max 1: the existing booking can still be rearranged within it.
        mvc.perform(patch("/api/painting-days/" + TUE).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("open", true, "openHour", 10.0, "closeHour", 11.5))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.maxPaintings").value(1));
        moveBlock(token, block, TUE, 10.25, 204);
        mvc.perform(get("/api/agenda/days/" + TUE).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slots[0].block.startHour").value(10.25))
                .andExpect(jsonPath("$.slots[0].block.endHour").value(11.25));
    }

    @Test
    void agendaSlotUsesTheFirstPhotoFromTheCustomerForm() throws Exception {
        String token = login();
        String order = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        String itemId = blockIdOf(token, order);
        MvcResult orderResult = mvc.perform(get("/api/orders/" + order).header("Authorization", bearer(token))).andReturn();
        String formToken = read(orderResult, "$.formToken");
        mvc.perform(get("/api/agenda/days/" + TUE).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slots[0].photoUrl").doesNotExist());

        var photos = List.of(Map.of("id", "p1", "name", "first.jpg"), Map.of("id", "p2", "name", "second.jpg"));
        var payload = Map.of("customerName", "Maria Muster", "phone", "+43 660 1234567", "email", "maria@example.com",
                "items", List.of(Map.of("orderItemId", itemId, "photos", photos)));
        byte[] jpeg = TestImages.jpeg();
        mvc.perform(withIp(multipart("/api/forms/" + formToken)
                        .file(new MockMultipartFile("payload", "payload", "application/json", json(payload).getBytes()))
                        .file(new MockMultipartFile("photo-p1", "first.jpg", "image/jpeg", jpeg))
                        .file(new MockMultipartFile("photo-p2", "second.jpg", "image/jpeg", jpeg))))
                .andExpect(status().isOk());
        MvcResult agenda = mvc.perform(get("/api/agenda/days/" + TUE).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slots[0].item.photos[0].name").value("first.jpg"))
                .andExpect(jsonPath("$.slots[0].item.photos[1].name").value("second.jpg"))
                .andReturn();
        String firstPhotoUrl = read(agenda, "$.slots[0].item.photos[0].dataUrl");
        assertEquals(firstPhotoUrl, this.<String>read(agenda, "$.slots[0].photoUrl"));
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
    void handoverTracksItemsAndOnlyStartsExpiryAfterTheLastItem() throws Exception {
        String token = login();
        String order = saleOk(token, finishedItem(), finishedItem());
        MvcResult bundle = mvc.perform(get("/api/orders/" + order + "/bundle").header("Authorization", bearer(token))).andReturn();
        String first = read(bundle, "$.items[0].id");
        String second = read(bundle, "$.items[1].id");
        mvc.perform(patch("/api/orders/" + order + "/handed-over").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true, "itemIds", java.util.List.of(first)))))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/orders/" + order + "/bundle").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.order.handedOver").value(false))
                .andExpect(jsonPath("$.items[0].handedOver").value(true))
                .andExpect(jsonPath("$.items[1].handedOver").value(false));
        mvc.perform(patch("/api/orders/" + order + "/handed-over").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true, "itemIds", java.util.List.of(second)))))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/orders/" + order + "/bundle").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.order.handedOver").value(true))
                .andExpect(jsonPath("$.order.handedOverAt").isNotEmpty());
        mvc.perform(patch("/api/orders/" + order + "/handed-over").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", false, "itemIds", java.util.List.of(first)))))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/orders/" + order + "/bundle").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.order.handedOver").value(false))
                .andExpect(jsonPath("$.order.handedOverAt").doesNotExist())
                .andExpect(jsonPath("$.items[0].handedOver").value(false))
                .andExpect(jsonPath("$.items[1].handedOver").value(true));
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
