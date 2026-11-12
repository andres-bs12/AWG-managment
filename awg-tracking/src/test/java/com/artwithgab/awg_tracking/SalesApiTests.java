package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CheckoutStatus;
import com.artwithgab.awg_tracking.enums.OrderSource;
import com.artwithgab.awg_tracking.enums.PaymentState;
import com.artwithgab.awg_tracking.model.Customer;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.repository.CustomerRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SalesApiTests extends ApiTestSupport {
    @Autowired OrderRepository orders;
    @Autowired CustomerRepository customers;

    private Order order(String name, String phone, String createdAt, PaymentState payment, OrderSource source, CheckoutStatus checkout) {
        var customer = new Customer();
        customer.setName(name);
        customer.setPhone(phone);
        customers.save(customer);
        var order = new Order();
        order.setCode("AWG" + UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        order.setFormToken(UUID.randomUUID().toString());
        order.setCustomer(customer);
        order.setCreatedAt(Instant.parse(createdAt));
        order.setPaymentState(payment);
        order.setTotal(new BigDecimal("49.99"));
        order.setSource(source);
        order.setCheckoutStatus(checkout);
        return orders.saveAndFlush(order);
    }

    @Test
    void salesRequiresStaffAndRejectsInvalidFilters() throws Exception {
        mvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());
        String token = login();
        for (var filter : new String[][]{{"state", "invalid"}, {"source", "other"}, {"page", "-1"}, {"size", "51"}, {"query", "x".repeat(101)}, {"query", "ab\0cd"}}) {
            mvc.perform(get("/api/orders").param(filter[0], filter[1]).header("Authorization", bearer(token)))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION"));
        }
        mvc.perform(get("/api/orders").param("from", "2026-11-25").param("to", "2026-11-24").header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void salesPagesNewestFirstWithoutReturningFormTokens() throws Exception {
        String token = login();
        for (int i = 0; i < 23; i++) order("Page customer", "", "2026-11-24T10:" + String.format("%02d", i) + ":00Z", PaymentState.UNPAID, OrderSource.STALL, null);
        var first = mvc.perform(get("/api/orders").param("query", "Page customer").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.orders.length()").value(20))
                .andExpect(jsonPath("$.totalElements").value(23)).andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.orders[0].createdAt").value("2026-11-24T10:22:00Z"))
                .andExpect(jsonPath("$.orders[0].source").value("stall"))
                .andExpect(jsonPath("$.orders[0].formToken").doesNotExist()).andReturn();
        var second = mvc.perform(get("/api/orders").param("query", "Page customer").param("page", "1").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.orders.length()").value(3)).andExpect(jsonPath("$.page").value(1)).andReturn();
        assertThat(this.<String>read(first, "$.orders[19].id")).isNotEqualTo(this.<String>read(second, "$.orders[0].id"));
        mvc.perform(get("/api/orders").param("query", "Page customer").param("page", "2").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.orders.length()").value(0)).andExpect(jsonPath("$.totalElements").value(23));
    }

    @Test
    void paymentStatesAndSourcesHaveDistinctFiltersAndLegacySourceIsStall() throws Exception {
        String token = login();
        order("State customer", "", "2026-11-24T10:00:00Z", PaymentState.UNPAID, null, null);
        order("State customer", "", "2026-11-24T11:00:00Z", PaymentState.DEPOSIT, OrderSource.STALL, null);
        order("State customer", "", "2026-11-24T12:00:00Z", PaymentState.PAID, OrderSource.WEB, CheckoutStatus.CONFIRMED);
        order("State customer", "", "2026-11-24T13:00:00Z", PaymentState.UNPAID, OrderSource.WEB, CheckoutStatus.PENDING);
        order("State customer", "", "2026-11-24T14:00:00Z", PaymentState.UNPAID, OrderSource.WEB, CheckoutStatus.REVIEW);
        for (String state : new String[]{"unpaid", "deposit", "paid", "pending", "review"}) {
            mvc.perform(get("/api/orders").param("query", "State customer").param("state", state).header("Authorization", bearer(token)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        }
        mvc.perform(get("/api/orders").param("query", "State customer").param("source", "stall").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/orders").param("query", "State customer").param("source", "web").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.totalElements").value(3));
    }

    @Test
    void calendarRangeUsesViennaInclusiveDaysAndRetainsCancelledSales() throws Exception {
        String token = login();
        order("Date customer", "", "2026-11-23T22:59:59Z", PaymentState.UNPAID, OrderSource.STALL, null);
        var start = order("Date customer", "", "2026-11-23T23:00:00Z", PaymentState.UNPAID, OrderSource.STALL, null);
        start.setStatus("CANCELLED");
        order("Date customer", "", "2026-11-24T22:59:59Z", PaymentState.UNPAID, OrderSource.STALL, null);
        order("Date customer", "", "2026-11-24T23:00:00Z", PaymentState.UNPAID, OrderSource.STALL, null);
        mvc.perform(get("/api/orders").param("query", "Date customer").param("from", "2026-11-24").param("to", "2026-11-24").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.orders[1].status").value("CANCELLED"));
    }

    @Test
    void queryFindsNameCodeAndPhoneDigitsWithoutTreatingWildcardsAsMatches() throws Exception {
        String token = login();
        var found = order("Zoë Example", "+43 (660) 12-34/567", "2026-11-24T10:00:00Z", PaymentState.UNPAID, OrderSource.STALL, null);
        for (String query : new String[]{"zoë ex", found.getCode().toLowerCase(), "6601234", "(660) 12"}) {
            mvc.perform(get("/api/orders").param("query", query).header("Authorization", bearer(token)))
                    .andExpect(jsonPath("$.orders[0].id").value(found.getId().toString()));
        }
        for (String query : new String[]{"66", "%_", "Q"}) {
            mvc.perform(get("/api/orders").param("query", query).header("Authorization", bearer(token)))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }
        found.setAnonymizedAt(Instant.parse("2026-11-24T11:00:00Z"));
        mvc.perform(get("/api/orders").param("query", "zoë ex").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.totalElements").value(0));
    }
}
