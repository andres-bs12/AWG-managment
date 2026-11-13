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

    private MvcResult putPrices(String token, String custom, String finished, String name, long revision) throws Exception {
        return mvc.perform(put("/api/prices").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("customPrice", new BigDecimal(custom), "finishedPrice", new BigDecimal(finished),
                        "nameExtra", new BigDecimal(name), "expectedRevision", revision)))).andReturn();
    }

    @Test void defaultsApplyUntilTheFirstSave() throws Exception {
        mvc.perform(get("/api/prices").header("Authorization", bearer(login())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customPrice").value(49.99))
                .andExpect(jsonPath("$.finishedPrice").value(39.99))
                .andExpect(jsonPath("$.nameExtra").value(12.99))
                .andExpect(jsonPath("$.revision").value(0));
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

        mvc.perform(withIp(get("/api/shop/config")))
                .andExpect(jsonPath("$.customPrice").value(55.0))
                .andExpect(jsonPath("$.finishedPrice").value(35.5))
                .andExpect(jsonPath("$.nameExtra").value(15.0));

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

    @Test void invoiceKeepsTheSurchargeChargedAtSaleTime() throws Exception {
        String token = login();
        UUID id = UUID.fromString(saleOk(token, customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.5)));
        // A later price change must not rewrite what this customer was charged.
        assertEquals(200, putPrices(token, "70.00", "40.00", "20.00", 0).getResponse().getStatus());
        orders.updatePaymentState(id, PaymentState.DEPOSIT, PaymentMethod.CARD, null);
        assertThat(invoices.findByOrderIdOrderByNumberAsc(id).getFirst().getBody()).contains("49,99 EUR", "12,99 EUR").doesNotContain("20,00 EUR");
    }
}
