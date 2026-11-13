package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Audit fixes (docs/sprint5-contract.md): idempotent sales, delivery-day rules, stock conflicts, error codes. */
class Sprint5ApiTests extends ApiTestSupport {

    @Autowired
    InventoryRepository inventory;
    @Autowired
    OrderRepository orders;

    private MvcResult saleWithKey(String token, String key, Map<String, Object>... items) throws Exception {
        return mvc.perform(post("/api/orders").header("Authorization", bearer(token)).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("items", new ArrayList<>(List.of(items)))))).andReturn();
    }

    @Test
    @SuppressWarnings("unchecked")
    void repeatedIdempotencyKeyReturnsTheSameOrderOnce() throws Exception {
        String token = login();
        int before = inventory.findFirstByItemKind(ItemKind.GENERIC).orElseThrow().getQuantity();
        long ordersBefore = orders.count();
        String key = "sale-draft-0001-abcd";

        MvcResult first = saleWithKey(token, key, finishedItem());
        assertThat(first.getResponse().getStatus()).isEqualTo(201);
        MvcResult again = saleWithKey(token, key, finishedItem());
        assertThat(again.getResponse().getStatus()).isEqualTo(200);
        assertThat(this.<String>read(again, "$.id")).isEqualTo(read(first, "$.id"));

        assertThat(orders.count()).isEqualTo(ordersBefore + 1);
        assertThat(inventory.findFirstByItemKind(ItemKind.GENERIC).orElseThrow().getQuantity()).isEqualTo(before - 1);
    }

    @Test
    @SuppressWarnings("unchecked")
    void malformedIdempotencyKeyIs400() throws Exception {
        MvcResult res = saleWithKey(login(), "bad key!", finishedItem());
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    @SuppressWarnings("unchecked")
    void viennaDeliveryOnAStallFridayIsRefused() throws Exception {
        String token = login();
        // Fri 27 Nov is a Rathausplatz day: the stall has priority.
        MvcResult res = sale(token, customItem(false, TUE, 10.0, 11.0, "vienna", dayId(token, "2026-11-27"), null));
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(this.<String>read(res, "$.code")).isEqualTo("DELIVERY_DAY_INVALID");
    }

    @Test
    @SuppressWarnings("unchecked")
    void viennaDeliveryOnSaturdayHasCode() throws Exception {
        String token = login();
        MvcResult res = sale(token, customItem(false, TUE, 10.0, 11.0, "vienna", dayId(token, SAT), null));
        assertThat(this.<String>read(res, "$.code")).isEqualTo("DELIVERY_DAY_INVALID");
    }

    @Test
    void stockUpdateWithStaleExpectedQuantityIs409() throws Exception {
        String token = login();
        var row = inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow();
        int now = row.getQuantity();

        mvc.perform(patch("/api/inventory/" + row.getId()).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("quantity", 7, "expectedQuantity", now + 1))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_CHANGED"));
        assertThat(inventory.findById(row.getId()).orElseThrow().getQuantity()).isEqualTo(now);

        mvc.perform(patch("/api/inventory/" + row.getId()).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("quantity", 7, "expectedQuantity", now))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quantity").value(7));
        // Without expectedQuantity the update still works (older clients).
        mvc.perform(patch("/api/inventory/" + row.getId()).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("quantity", now))))
                .andExpect(status().isOk());
    }

    @Test
    void errorsCarryStableCodes() throws Exception {
        mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(withIp(get("/api/track/AWGZZZZZZ"))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void finishedOrnamentHandedOverNowOnAHomeDay() throws Exception {
        String token = login();
        Map<String, Object> item = finishedItem();
        item.put("marketDayId", dayId(token, TUE)); // today is a home (Casa) day, no stall
        MvcResult res = sale(token, item);
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(201);
    }

    @Test
    void wrongContentTypeIs415NotA500() throws Exception {
        mvc.perform(post("/api/orders").header("Authorization", bearer(login()))
                        .contentType(MediaType.TEXT_PLAIN).content("x"))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(withIp(post("/api/shop/checkout")).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isBetween(400, 499));
    }
}
