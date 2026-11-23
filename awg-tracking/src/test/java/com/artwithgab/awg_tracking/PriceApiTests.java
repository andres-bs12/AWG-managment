package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.PaymentMethod;
import com.artwithgab.awg_tracking.enums.PaymentState;
import com.artwithgab.awg_tracking.repository.InvoiceRepository;
import com.artwithgab.awg_tracking.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PriceApiTests extends ApiTestSupport {
    @Autowired InvoiceRepository invoices;
    @Autowired OrderService orders;
    @Autowired com.artwithgab.awg_tracking.repository.PriceSettingRepository settings;

    private MvcResult putPrices(String token, String custom, String finished, String name, long revision) throws Exception {
        return mvc.perform(put("/api/prices").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("customPrice", new BigDecimal(custom), "finishedPrice", new BigDecimal(finished),
                        "nameExtra", new BigDecimal(name), "expectedRevision", revision,
                        "shippingFee", new BigDecimal("6.25"), "postCollectionDays", java.util.List.of("monday", "thursday"))))).andReturn();
    }

    @Test void defaultsApplyUntilTheFirstSave() throws Exception {
        mvc.perform(get("/api/prices").header("Authorization", bearer(login())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customPrice").value(49.99))
                .andExpect(jsonPath("$.finishedPrice").value(39.99))
                .andExpect(jsonPath("$.nameExtra").value(12.99))
                .andExpect(jsonPath("$.shippingFee").value(5.0))
                .andExpect(jsonPath("$.postCollectionDays[0]").value("tuesday"))
                .andExpect(jsonPath("$.postCollectionDays[1]").value("friday"))
                .andExpect(jsonPath("$.backNameMax").value(5))
                .andExpect(jsonPath("$.revision").value(0));
        mvc.perform(withIp(get("/api/shop/config"))).andExpect(jsonPath("$.backNameMax").value(5));
    }

    @Test void anExistingPriceRowWithoutShippingSettingsUsesDefaults() throws Exception {
        var row = new com.artwithgab.awg_tracking.model.PriceSetting();
        row.setId(com.artwithgab.awg_tracking.model.PriceSetting.ID);
        row.setCustomPrice(new BigDecimal("51.00"));
        row.setFinishedPrice(new BigDecimal("41.00"));
        row.setNameExtra(new BigDecimal("13.00"));
        row.setRevision(7);
        row.setUpdatedAt(java.time.Instant.parse("2026-11-20T00:00:00Z"));
        settings.save(row);
        mvc.perform(get("/api/prices").header("Authorization", bearer(login())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.revision").value(7))
                .andExpect(jsonPath("$.customPrice").value(51))
                .andExpect(jsonPath("$.shippingFee").value(5))
                .andExpect(jsonPath("$.postCollectionDays[0]").value("tuesday"));
    }

    private MvcResult putBackNameMax(String token, Object max, long revision) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>(Map.of("customPrice", new BigDecimal("49.99"),
                "finishedPrice", new BigDecimal("39.99"), "nameExtra", new BigDecimal("12.99"), "expectedRevision", revision,
                "shippingFee", new BigDecimal("5.00"), "postCollectionDays", java.util.List.of("tuesday", "friday")));
        body.put("backNameMax", max);
        return mvc.perform(put("/api/prices").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(json(body))).andReturn();
    }

    @Test void backNameMaxIsEditableAndBounded() throws Exception {
        String token = login();
        assertEquals(400, putBackNameMax(token, 0, 0).getResponse().getStatus());
        assertEquals(400, putBackNameMax(token, 21, 0).getResponse().getStatus());
        MvcResult saved = putBackNameMax(token, 8, 0);
        assertEquals(200, saved.getResponse().getStatus(), saved.getResponse().getContentAsString());
        assertEquals(8, this.<Integer>read(saved, "$.backNameMax"));
        mvc.perform(withIp(get("/api/shop/config"))).andExpect(jsonPath("$.backNameMax").value(8));
        // Omitting the field keeps the saved limit.
        MvcResult kept = putPrices(token, "49.99", "39.99", "12.99", 1);
        assertEquals(200, kept.getResponse().getStatus());
        assertEquals(8, this.<Integer>read(kept, "$.backNameMax"));
    }

    @Test void pricesAreStaffOnly() throws Exception {
        mvc.perform(withIp(get("/api/prices"))).andExpect(status().isUnauthorized());
        mvc.perform(withIp(put("/api/prices")).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test void savedPricesReachShopConfigAndNewSales() throws Exception {
        String token = login();
        MvcResult saved = putPrices(token, "55.00", "35.50", "15.00", 0);
        assertEquals(200, saved.getResponse().getStatus(), saved.getResponse().getContentAsString());
        assertEquals(1, this.<Integer>read(saved, "$.revision"));
        assertThat(this.<java.util.List<String>>read(saved, "$.postCollectionDays"))
                .containsExactly("monday", "thursday");

        mvc.perform(withIp(get("/api/shop/config")))
                .andExpect(jsonPath("$.customPrice").value(55.0))
                .andExpect(jsonPath("$.finishedPrice").value(35.5))
                .andExpect(jsonPath("$.nameExtra").value(15.0))
                .andExpect(jsonPath("$.deliveryFee").value(6.25));

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/shipping/window")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("readyOn", "2026-11-27"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionDate").value("2026-11-30"));

        MvcResult sale = sale(token, customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.0), finishedItem());
        assertEquals(201, sale.getResponse().getStatus(), sale.getResponse().getContentAsString());
        assertEquals(0, new BigDecimal("105.50").compareTo(new BigDecimal(this.<Object>read(sale, "$.total").toString())));
    }

    @Test void staleRevisionIsAConflict() throws Exception {
        String token = login();
        assertEquals(200, putPrices(token, "50.00", "40.00", "13.00", 0).getResponse().getStatus());
        MvcResult stale = putPrices(token, "60.00", "40.00", "13.00", 0);
        assertEquals(409, stale.getResponse().getStatus());
        assertEquals("PRICES_CHANGED", this.<String>read(stale, "$.code"));
    }

    @Test void invalidPricesAreRejected() throws Exception {
        String token = login();
        assertEquals(400, putPrices(token, "0.10", "40.00", "13.00", 0).getResponse().getStatus());
        assertEquals(400, putPrices(token, "50.00", "40.00", "-1.00", 0).getResponse().getStatus());
        assertEquals(400, putPrices(token, "50.001", "40.00", "13.00", 0).getResponse().getStatus());
        assertEquals(400, putPrices(token, "1000.00", "40.00", "13.00", 0).getResponse().getStatus());
    }

    @Test void invalidShippingSettingsAreRejected() throws Exception {
        String token = login();
        var body = new java.util.HashMap<String, Object>(Map.of(
                "customPrice", 50, "finishedPrice", 40, "nameExtra", 13, "expectedRevision", 0,
                "shippingFee", 5, "postCollectionDays", java.util.List.of("monday", "monday")));
        for (var days : java.util.List.of(java.util.List.of("monday", "monday"), java.util.List.of("saturday"), java.util.List.of())) {
            body.put("postCollectionDays", days);
            mvc.perform(put("/api/prices").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                    .content(json(body))).andExpect(status().isBadRequest());
        }
        body.put("postCollectionDays", java.util.List.of("monday"));
        body.put("shippingFee", 100);
        mvc.perform(put("/api/prices").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(json(body))).andExpect(status().isBadRequest());
    }

    @Test void invoiceKeepsTheSurchargeChargedAtSaleTime() throws Exception {
        String token = login();
        UUID id = UUID.fromString(saleOk(token, customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.5)));
        // A later price change must not rewrite what this customer was charged.
        assertEquals(200, putPrices(token, "70.00", "40.00", "20.00", 0).getResponse().getStatus());
        orders.updatePaymentState(id, PaymentState.DEPOSIT, PaymentMethod.CARD, null);
        assertThat(invoices.findByOrderIdOrderByNumberAsc(id).getFirst().getBody()).contains("49,99 EUR", "12,99 EUR").doesNotContain("20,00 EUR");
    }
}
