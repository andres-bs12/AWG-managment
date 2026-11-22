package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CheckoutStatus;
import com.artwithgab.awg_tracking.enums.OrderSource;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Owner, 2026-11-22: a new paid web order stays in "Needs attention" until staff marks it reviewed. */
class OrderReviewApiTests extends ApiTestSupport {
    @Autowired OrderRepository orders;

    @Test void stallSalesStartReviewedAndStayOutOfAttention() throws Exception {
        String token = login();
        String id = saleOk(token, finishedItem());
        assertNotNull(orders.findById(UUID.fromString(id)).orElseThrow().getReviewedAt());
        List<String> attention = read(mvc.perform(get("/api/orders/attention").header("Authorization", bearer(token))).andReturn(), "$[*].id");
        assertFalse(attention.contains(id));
    }

    @Test void paidWebOrderNeedsReviewUntilStaffMarksIt() throws Exception {
        String token = login();
        String id = webOrder(token, CheckoutStatus.CONFIRMED);

        var attention = mvc.perform(get("/api/orders/attention").header("Authorization", bearer(token))).andExpect(status().isOk()).andReturn();
        List<String> ids = read(attention, "$[*].id");
        assertTrue(ids.contains(id));
        List<Boolean> flags = read(attention, "$[?(@.id=='" + id + "')].needsReview");
        assertEquals(List.of(true), flags);
        assertEquals(Boolean.TRUE, read(mvc.perform(get("/api/orders/" + id).header("Authorization", bearer(token))).andReturn(), "$.needsReview"));

        var reviewed = mvc.perform(post("/api/orders/" + id + "/reviewed").header("Authorization", bearer(token))).andExpect(status().isOk()).andReturn();
        assertEquals(Boolean.FALSE, read(reviewed, "$.needsReview"));
        String firstReview = read(reviewed, "$.reviewedAt");
        assertNotNull(firstReview);
        // Repeating it is harmless and keeps the first time.
        var again = mvc.perform(post("/api/orders/" + id + "/reviewed").header("Authorization", bearer(token))).andExpect(status().isOk()).andReturn();
        assertEquals(firstReview, read(again, "$.reviewedAt"));
        List<String> after = read(mvc.perform(get("/api/orders/attention").header("Authorization", bearer(token))).andReturn(), "$[*].id");
        assertFalse(after.contains(id));
    }

    @Test void unpaidOrCancelledWebOrdersAreNotReviewItems() throws Exception {
        String token = login();
        String pending = webOrder(token, CheckoutStatus.PENDING);
        assertFalse(orders.findById(UUID.fromString(pending)).orElseThrow().needsReview());
        String cancelled = webOrder(token, CheckoutStatus.CONFIRMED);
        var order = orders.findById(UUID.fromString(cancelled)).orElseThrow();
        order.setStatus("CANCELLED");
        orders.saveAndFlush(order);
        List<String> attention = read(mvc.perform(get("/api/orders/attention").header("Authorization", bearer(token))).andReturn(), "$[*].id");
        assertFalse(attention.contains(cancelled));
    }

    @Test void reviewingAnUnpaidCheckoutDoesNotHideItsLaterPayment() throws Exception {
        String token = login();
        String id = webOrder(token, CheckoutStatus.PENDING);
        mvc.perform(post("/api/orders/" + id + "/reviewed").header("Authorization", bearer(token))).andExpect(status().isOk());
        var order = orders.findById(UUID.fromString(id)).orElseThrow();
        assertNull(order.getReviewedAt());
        order.setCheckoutStatus(CheckoutStatus.CONFIRMED);
        orders.saveAndFlush(order);
        assertTrue(orders.findById(UUID.fromString(id)).orElseThrow().needsReview());
    }

    @Test void reviewNeedsAStaffSession() throws Exception {
        String id = webOrder(login(), CheckoutStatus.CONFIRMED);
        mvc.perform(post("/api/orders/" + id + "/reviewed")).andExpect(status().isUnauthorized());
        assertNull(orders.findById(UUID.fromString(id)).orElseThrow().getReviewedAt());
    }

    /** Turns a fresh stall sale into a web order in the given checkout state, as the shop would leave it. */
    private String webOrder(String token, CheckoutStatus state) throws Exception {
        String id = saleOk(token, finishedItem());
        var order = orders.findById(UUID.fromString(id)).orElseThrow();
        order.setSource(OrderSource.WEB);
        order.setCheckoutStatus(state);
        order.setReviewedAt(null);
        orders.saveAndFlush(order);
        return id;
    }
}
