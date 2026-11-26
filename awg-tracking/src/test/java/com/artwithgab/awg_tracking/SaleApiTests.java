package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SaleApiTests extends ApiTestSupport {

    @Autowired
    InventoryRepository inventory;

    @Autowired
    OrderRepository orders;

    @Test
    void customPlusFinishedSaleTotals10297AndDeductsStock() throws Exception {
        String token = login();
        int redBefore = inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity();
        int genericBefore = inventory.findFirstByItemKind(ItemKind.GENERIC).orElseThrow().getQuantity();

        Map<String, Object> custom = customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.0);
        custom.put("cost", 1); // client-sent prices must be ignored
        custom.put("price", 1);
        Map<String, Object> finished = finishedItem();
        finished.put("cost", 1);

        MvcResult res = sale(token, custom, finished);
        assertEquals(201, res.getResponse().getStatus(), res.getResponse().getContentAsString());
        assertEquals(0, new BigDecimal("97.99").compareTo(new BigDecimal(this.<Object>read(res, "$.total").toString())));

        assertEquals(redBefore - 1, inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity());
        assertEquals(genericBefore, inventory.findFirstByItemKind(ItemKind.GENERIC).orElseThrow().getQuantity());
    }

    @Test
    void staffDiscountChargesLessAndKeepsListPrice() throws Exception {
        String token = login();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", java.util.List.of(customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.0), finishedItem()));
        body.put("chargedTotal", 90);
        MvcResult res = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/orders")
                .header("Authorization", bearer(token)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(json(body))).andReturn();
        assertEquals(201, res.getResponse().getStatus(), res.getResponse().getContentAsString());
        assertEquals(0, new BigDecimal("90").compareTo(new BigDecimal(this.<Object>read(res, "$.total").toString())));
        assertEquals(0, new BigDecimal("7.99").compareTo(new BigDecimal(this.<Object>read(res, "$.discount").toString())));
        String id = read(res, "$.id");
        mvc.perform(patch("/api/orders/" + id + "/payment-state").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("state", "paid", "method", "cash"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amountPaid").value(90.0));
    }

    @Test
    void staffPriceAboveListPriceIs400() throws Exception {
        String token = login();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", java.util.List.of(finishedItem()));
        body.put("chargedTotal", 1000);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/orders")
                        .header("Authorization", bearer(token)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(json(body)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The sale price can't be higher than the list price."));
    }

    @Test
    void staffCanChangeThePriceOfAPastSale() throws Exception {
        String token = login();
        String id = saleOk(token, finishedItem());
        mvc.perform(patch("/api/orders/" + id + "/payment-state").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("state", "paid", "method", "cash"))))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/orders/" + id + "/price").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("chargedTotal", 30))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(30.0))
                .andExpect(jsonPath("$.discount").value(5.0))
                .andExpect(jsonPath("$.amountPaid").value(30.0))
                .andExpect(jsonPath("$.paymentState").value("paid"));
        // Undo the discount: back to the list price, never above it.
        mvc.perform(patch("/api/orders/" + id + "/price").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("chargedTotal", 35))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.discount").value(0.0));
        mvc.perform(patch("/api/orders/" + id + "/price").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("chargedTotal", 36))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void raisingThePriceOfAPaidSaleNeverBooksMoneyNotReceived() throws Exception {
        String token = login();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", java.util.List.of(finishedItem()));
        body.put("chargedTotal", 30);
        MvcResult res = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/orders")
                .header("Authorization", bearer(token)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(json(body))).andReturn();
        assertEquals(201, res.getResponse().getStatus(), res.getResponse().getContentAsString());
        String id = read(res, "$.id");
        mvc.perform(patch("/api/orders/" + id + "/payment-state").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("state", "paid", "method", "cash"))))
                .andExpect(jsonPath("$.amountPaid").value(30.0));
        // Undo the discount: 30 was received, so 5 is still owed.
        mvc.perform(patch("/api/orders/" + id + "/price").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("chargedTotal", 35))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(35.0))
                .andExpect(jsonPath("$.amountPaid").value(30.0))
                .andExpect(jsonPath("$.paymentState").value("deposit"));
        // Back down to what was received: paid again.
        mvc.perform(patch("/api/orders/" + id + "/price").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("chargedTotal", 30))))
                .andExpect(jsonPath("$.amountPaid").value(30.0))
                .andExpect(jsonPath("$.paymentState").value("paid"));
    }

    @Test
    void raisingThePriceOfAFreePaidSaleMakesItUnpaid() throws Exception {
        String token = login();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", java.util.List.of(finishedItem()));
        body.put("chargedTotal", 0);
        MvcResult res = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/orders")
                .header("Authorization", bearer(token)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(json(body))).andReturn();
        assertEquals(201, res.getResponse().getStatus(), res.getResponse().getContentAsString());
        String id = read(res, "$.id");
        mvc.perform(patch("/api/orders/" + id + "/payment-state").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("state", "paid", "method", "cash"))))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/orders/" + id + "/price").header("Authorization", bearer(token))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(json(Map.of("chargedTotal", 35))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amountPaid").value(0.0))
                .andExpect(jsonPath("$.paymentState").value("unpaid"));
    }

    @Test
    void paintSlotClashIs409() throws Exception {
        String token = login();
        String sat = dayId(token, SAT);
        saleOk(token, customItem(true, TUE, 10.0, 11.25, "market", sat, 14.0));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/orders")
                        .header("Authorization", bearer(token)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(json(Map.of("items", java.util.List.of(customItem(false, TUE, 10.5, 11.5, "market", sat, 14.0))))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("That hour is taken · change / place on board"));
    }

    @Test
    void customWithoutPaintSlotIs400() throws Exception {
        String token = login();
        MvcResult res = sale(token, customItem(false, null, null, null, "market", dayId(token, SAT), 14.0));
        assertEquals(400, res.getResponse().getStatus());
        assertEquals("Custom ornament needs a paint slot", this.<String>read(res, "$.message"));
    }

    @Test
    void marketCustomWithoutPickupHourIs400() throws Exception {
        String token = login();
        MvcResult res = sale(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), null));
        assertEquals(400, res.getResponse().getStatus());
        assertEquals("Choose a pickup hour before planning the painting time", this.<String>read(res, "$.message"));
    }

    @Test
    void paintAfterPickupIs400() throws Exception {
        String token = login();
        // Pickup Saturday, painting planned on Sunday.
        MvcResult res = sale(token, customItem(false, SUN, 12.0, 13.0, "market", dayId(token, SAT), 14.0));
        assertEquals(400, res.getResponse().getStatus());
        assertEquals("Choose a paint time before pickup, within working hours.", this.<String>read(res, "$.message"));
    }

    @Test
    void newViennaDeliveryIsRejectedEvenOnAnOldDeliveryDay() throws Exception {
        String token = login();
        MvcResult res = sale(token, customItem(false, TUE, 10.0, 11.0, "vienna", dayId(token, WED), null));
        assertEquals(400, res.getResponse().getStatus());
        assertEquals("items[0].deliveryKind", this.<String>read(res, "$.field"));
    }

    @Test
    void emptyItemListIs400() throws Exception {
        String token = login();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", java.util.List.of());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/orders")
                        .header("Authorization", bearer(token)).contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content(json(body)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sameDayPickupRequiresFifteenMinutesAfterPaintEnd() throws Exception {
        String token = login();
        String sat = dayId(token, SAT);
        // 13:00-14:00 with pickup at 14:00 leaves 0 min handling -> rejected.
        MvcResult tooSoon = sale(token, customItem(false, SAT, 13.0, 14.0, "market", sat, 14.0));
        assertEquals(400, tooSoon.getResponse().getStatus());
        assertEquals("Choose a paint time before pickup, within working hours.", this.<String>read(tooSoon, "$.message"));

        // 13:00-14:00 with pickup at 15:00 (or 12:45-13:45 with pickup at 14:00) -> accepted.
        MvcResult okQuarter = sale(token, customItem(false, SAT, 12.75, 13.75, "market", sat, 14.0));
        assertEquals(201, okQuarter.getResponse().getStatus(), okQuarter.getResponse().getContentAsString());
    }

    @Test
    void legacyViennaPaintingMustStayBeforeTheHandoffDay() throws Exception {
        String token = login();
        UUID orderId = UUID.fromString(legacyViennaOrder(token, 10.0, false));
        UUID itemId = orders.findById(orderId).orElseThrow().getOrderItems().getFirst().getId();

        mvc.perform(patch("/api/agenda/blocks/{id}", itemId)
                        .header("Authorization", bearer(token)).contentType("application/json")
                        .content(json(Map.of("date", WED, "startHour", 10))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Vienna orders must be painted before the handoff day"));

        mvc.perform(patch("/api/agenda/blocks/{id}", itemId)
                        .header("Authorization", bearer(token)).contentType("application/json")
                        .content(json(Map.of("date", TUE, "startHour", 11))))
                .andExpect(status().isNoContent());
    }
}
