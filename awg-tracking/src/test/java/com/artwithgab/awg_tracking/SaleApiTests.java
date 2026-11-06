package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SaleApiTests extends ApiTestSupport {

    @Autowired
    InventoryRepository inventory;

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
        assertEquals(0, new BigDecimal("102.97").compareTo(new BigDecimal(this.<Object>read(res, "$.total").toString())));

        assertEquals(redBefore - 1, inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity());
        assertEquals(genericBefore - 1, inventory.findFirstByItemKind(ItemKind.GENERIC).orElseThrow().getQuantity());
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
    void viennaDeliveryOnSaturdayIs400() throws Exception {
        String token = login();
        MvcResult res = sale(token, customItem(false, TUE, 10.0, 11.0, "vienna", dayId(token, SAT), null));
        assertEquals(400, res.getResponse().getStatus());
        assertEquals("Vienna deliveries are on Wednesday or Friday", this.<String>read(res, "$.message"));
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
}
