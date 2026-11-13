package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.payment.StripeClient;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Web shop: Vienna-only delivery days from real capacity, Stripe checkout and webhook (Stripe mocked). */
@TestPropertySource(properties = "awg.shop.enabled=true")
class ShopApiTests extends ApiTestSupport {
    private static final byte[] JPEG = TestImages.jpeg();

    @MockitoBean
    StripeClient stripe;
    @Autowired
    OrderRepository orderRepository;
    @Autowired
    InventoryRepository inventoryRepository;
    @Autowired
    com.artwithgab.awg_tracking.repository.InvoiceRepository invoices;
    @Autowired
    com.artwithgab.awg_tracking.service.ShopService shopService;
    @Autowired
    tools.jackson.databind.ObjectMapper objectMapper;
    @Autowired
    com.artwithgab.awg_tracking.config.AwgProperties props;

    @BeforeEach
    void stripeOk() {
        when(stripe.isConfigured()).thenReturn(true);
        when(stripe.createCheckoutSession(anyString(), anyString(), anyString(), anyList(), any()))
                .thenReturn(new StripeClient.Session("cs_test_1", "https://checkout.stripe.test/cs_test_1"));
        when(stripe.verifySignature(anyString(), anyString())).thenReturn(true);
        when(stripe.expireOrReconcile(anyString())).thenReturn("expired");
    }

    private List<String> dates(List<Map<String, Object>> items) throws Exception {
        MvcResult res = mvc.perform(withIp(post("/api/shop/delivery-dates")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("items", items)))).andExpect(status().isOk()).andReturn();
        return read(res, "$[*].date");
    }

    private MvcResult checkout(String postal, String date, int customs) throws Exception {
        return checkout(postal, date, customs, "eva@example.com", freshIp());
    }

    private MvcResult checkout(String postal, String date, int customs, String email, String ip) throws Exception {
        return checkoutNamed(postal, date, customs, email, ip, "luna");
    }

    private MvcResult checkoutNamed(String postal, String date, int customs, String email, String ip, String backName) throws Exception {
        List<Map<String, Object>> items = new ArrayList<>();
        var req = multipart("/api/shop/checkout");
        for (int i = 0; i < customs; i++) {
            items.add(Map.of("kind", "custom", "withName", i == 0, "color", "red", "finish", "shiny", "petName", "Luna" + i,
                    "backName", backName, "photos", List.of(Map.of("id", "p" + i, "name", "luna.jpg"))));
            req.file(new MockMultipartFile("photo-p" + i, "luna.jpg", "image/jpeg", JPEG));
        }
        Map<String, Object> payload = Map.of("customerName", "Eva Gruber", "email", email, "phone", "+43 1 234",
                "address", Map.of("line1", "Neubaugasse 1", "city", "Wien", "postalCode", postal),
                "deliveryDate", date, "acceptTerms", true, "items", items);
        req.file(new MockMultipartFile("payload", "", "application/json", json(payload).getBytes()));
        return mvc.perform(req.with(r -> { r.setRemoteAddr(ip); return r; })).andReturn();
    }

    @Test
    void rejectsLetteringThatExpandsBeyondSixOnUppercase() throws Exception {
        var res = checkoutNamed("1070", "2026-12-02", 1, "eva@example.com", freshIp(), "Straße");
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(this.<String>read(res, "$.code")).isEqualTo("VALIDATION");
        assertThat(this.<String>read(res, "$.field")).isEqualTo("items[0].backName");
        org.mockito.Mockito.verify(stripe, org.mockito.Mockito.never()).createCheckoutSession(anyString(), anyString(), anyString(), anyList(), any());
    }

    @Test
    void acceptsSixLettersAfterUppercaseExpansion() throws Exception {
        var res = checkoutNamed("1070", "2026-12-02", 1, "eva@example.com", freshIp(), "ßßß");
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        String code = read(res, "$.orderCode");
        assertThat(orderRepository.findByCodeIgnoreCase(code).orElseThrow().getOrderItems().getFirst().getNameInOrnament()).isEqualTo("SSSSSS");
    }

    private void webhook(String type, String paymentStatus, long amount) throws Exception {
        String event = json(Map.of("type", type, "data", Map.of("object",
                Map.of("id", "cs_test_1", "payment_status", paymentStatus, "amount_total", amount, "currency", "eur"))));
        mvc.perform(post("/api/shop/stripe/webhook").header("Stripe-Signature", "t=1,v1=00")
                .contentType(MediaType.APPLICATION_JSON).content(event)).andExpect(status().isOk());
    }

    @Test
    void configIsPublicAndOpen() throws Exception {
        mvc.perform(get("/api/shop/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.customPrice").value(49.99));
    }

    @Test
    void deliveryDaysAreWedOrFriWithPaintingTimeBefore() throws Exception {
        // Today is Tue 24: Wed 25 has no painting day before it (from tomorrow); Fri 27 is a stall day.
        List<String> d = dates(List.of(Map.of("kind", "custom", "withName", true)));
        assertThat(d).isNotEmpty().doesNotContain("2026-11-25");
        assertThat(d.getFirst()).isEqualTo("2026-12-02");
        // Wed/Fri, plus 24 Dec (a Thursday) as the season's last delivery; nothing after it.
        assertThat(d).allSatisfy(x -> assertThat(x.equals("2026-12-24") || java.time.LocalDate.parse(x).getDayOfWeek() == java.time.DayOfWeek.WEDNESDAY
                || java.time.LocalDate.parse(x).getDayOfWeek() == java.time.DayOfWeek.FRIDAY).isTrue());
        assertThat(d.getLast()).isEqualTo("2026-12-24");
    }

    @Test
    void marketFridaysAreNotOfferedAndCannotBeBooked() throws Exception {
        // Rathausplatz runs Fri-Sun from 27 Nov to 21 Dec: the stall has priority on those Fridays.
        assertThat(dates(List.of(Map.of("kind", "custom", "withName", false))))
                .doesNotContain("2026-11-27", "2026-12-04", "2026-12-11", "2026-12-18");
        assertThat(checkout("1070", "2026-11-27", 1).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    void outsideViennaIsRejected() throws Exception {
        MvcResult res = checkout("4020", "2026-12-02", 1);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(res.getResponse().getContentAsString()).contains("only deliver inside Vienna");
    }

    @Test
    void paidCheckoutAppearsInAgendaAndDeliveries() throws Exception {
        int stockBefore = inventoryRepository.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity();
        MvcResult res = checkout("1070", "2026-12-02", 2);
        assertThat(res.getResponse().getStatus()).isEqualTo(200);
        String code = read(res, "$.orderCode");
        assertThat((String) read(res, "$.checkoutUrl")).startsWith("https://checkout.stripe.test/");
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        assertThat(order.isAwaitingPayment()).isTrue();
        assertThat(order.getOrderItems()).allSatisfy(i -> {
            assertThat(i.getPaintStart()).isNotNull();
            assertThat(i.getPaintEnd().toLocalDate()).isBefore(java.time.LocalDate.of(2026, 12, 2));
            assertThat(i.getPhotos()).hasSize(1);
        });
        assertThat(inventoryRepository.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity())
                .isEqualTo(stockBefore - 2);

        String token = login();
        // Pending: hidden from the delivery list.
        mvc.perform(get("/api/agenda/days/2026-12-02").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.deliveries[?(@.orderCode=='" + code + "')]").isEmpty());

        long cents = order.getTotal().movePointRight(2).longValueExact();
        webhook("checkout.session.completed", "paid", cents);
        var paid = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        assertThat(paid.isAwaitingPayment()).isFalse();
        assertThat(paid.getPaymentState().name()).isEqualTo("PAID");
        webhook("checkout.session.completed", "paid", cents);
        var documents = invoices.findByOrderIdOrderByNumberAsc(order.getId());
        assertThat(documents).hasSize(1);
        assertThat(documents.getFirst().getBody()).contains("Offener Betrag: 0,00 EUR", "18:00–20:00", "Lieferkosten:", "1.", "2.");
        mvc.perform(get("/api/metrics/buy").param("from", TUE).param("to", TUE).header("Authorization", bearer(token)))
                .andExpect(jsonPath("$[?(@.event == 'buy_paid')].count").value(1));

        mvc.perform(get("/api/agenda/days/2026-12-02").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.deliveries[?(@.orderCode=='" + code + "')].methodLabel").value(org.hamcrest.Matchers.hasItem("Vienna · Wed 2 Dec")))
                .andExpect(jsonPath("$.deliveries[?(@.orderCode=='" + code + "')].source").value(org.hamcrest.Matchers.hasItem("web")));
    }

    @Test
    void wrongAmountDoesNotConfirm() throws Exception {
        String code = read(checkout("1070", "2026-12-02", 1), "$.orderCode");
        webhook("checkout.session.completed", "paid", 1);
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        // Not confirmed and not released: staff must check it in Stripe.
        assertThat(order.isPaymentReview()).isTrue();
        assertThat(order.getPaymentState().name()).isEqualTo("UNPAID");
        webhook("checkout.session.expired", "unpaid", 0);
        assertThat(orderRepository.findByCodeIgnoreCase(code)).isPresent();
        String token = login();
        mvc.perform(get("/api/orders/" + order.getId()).header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.paymentReview").value(true));
        // Kept out of the production lists until resolved.
        mvc.perform(get("/api/agenda/days/2026-12-02").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.deliveries[?(@.orderCode=='" + code + "')]").isEmpty());
        // Resolving needs a deliberate paid/deposit record; "unpaid" does not clear it.
        mvc.perform(patch("/api/orders/" + order.getId() + "/payment-state").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("state", "unpaid"))))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/orders/" + order.getId() + "/payment-state").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("state", "paid", "method", "card"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paymentReview").value(false));
        mvc.perform(get("/api/agenda/days/2026-12-02").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.deliveries[?(@.orderCode=='" + code + "')]").isNotEmpty());
    }

    @Test
    void abandonReleasesThePendingCheckout() throws Exception {
        int stockBefore = inventoryRepository.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity();
        MvcResult res = checkout("1070", "2026-12-02", 1);
        String code = read(res, "$.orderCode");
        String formToken = read(res, "$.formToken");
        // Without the token (or with another one) nothing happens.
        mvc.perform(withIp(post("/api/shop/checkout/" + code + "/abandon"))).andExpect(status().isNoContent());
        mvc.perform(withIp(post("/api/shop/checkout/" + code + "/abandon")).header("X-Form-Token", "wrong-token-wrong-token"))
                .andExpect(status().isNoContent());
        assertThat(orderRepository.findByCodeIgnoreCase(code)).isPresent();

        mvc.perform(withIp(post("/api/shop/checkout/" + code + "/abandon")).header("X-Form-Token", formToken))
                .andExpect(status().isNoContent());
        assertThat(orderRepository.findByCodeIgnoreCase(code)).isEmpty();
        org.mockito.Mockito.verify(stripe).expireOrReconcile("cs_test_1");
        assertThat(inventoryRepository.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity())
                .isEqualTo(stockBefore);
    }

    @Test
    void abandonKeepsAnOrderPaidMeanwhile() throws Exception {
        when(stripe.expireOrReconcile(anyString())).thenReturn("complete");
        MvcResult res = checkout("1070", "2026-12-02", 1);
        String code = read(res, "$.orderCode");
        mvc.perform(withIp(post("/api/shop/checkout/" + code + "/abandon")).header("X-Form-Token", this.<String>read(res, "$.formToken")))
                .andExpect(status().isNoContent());
        assertThat(orderRepository.findByCodeIgnoreCase(code)).isPresent();
    }

    @Test
    void outsideViennaReturnsCodeAndField() throws Exception {
        MvcResult res = checkout("4020", "2026-12-02", 1);
        assertThat(this.<String>read(res, "$.code")).isEqualTo("POSTAL_OUTSIDE_VIENNA");
        assertThat(this.<String>read(res, "$.field")).isEqualTo("address.postalCode");
    }

    @Test
    void expiredCheckoutReleasesSlotsAndStock() throws Exception {
        int stockBefore = inventoryRepository.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity();
        String code = read(checkout("1070", "2026-12-02", 1), "$.orderCode");
        webhook("checkout.session.expired", "unpaid", 0);
        assertThat(orderRepository.findByCodeIgnoreCase(code)).isEmpty();
        assertThat(inventoryRepository.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity())
                .isEqualTo(stockBefore);
    }

    @Test
    void badSignatureIs400() throws Exception {
        when(stripe.verifySignature(anyString(), anyString())).thenReturn(false);
        mvc.perform(post("/api/shop/stripe/webhook").header("Stripe-Signature", "t=1,v1=00")
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
    }

    @Test
    void configListsColorsWithStock() throws Exception {
        mvc.perform(get("/api/shop/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.colors[?(@.color=='red')].inStock").value(org.hamcrest.Matchers.hasItem(true)))
                .andExpect(jsonPath("$.finishedPrice").value(39.99));
    }

    @Test
    void finishedOrnamentsCannotBeBoughtOnline() throws Exception {
        mvc.perform(withIp(post("/api/shop/delivery-dates")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("items", List.of(Map.of("kind", "finished", "withName", false))))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cleanupConfirmsAPaidSessionWhoseWebhookIsLate() throws Exception {
        String code = read(checkout("1070", "2026-12-02", 1), "$.orderCode");
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        order.setCheckoutExpiresAt(java.time.Instant.parse("2026-01-01T00:00:00Z"));
        orderRepository.save(order);
        long cents = order.getTotal().movePointRight(2).longValueExact();
        when(stripe.expireOrReconcile("cs_test_1")).thenReturn("complete");
        when(stripe.retrieveSession("cs_test_1")).thenReturn(objectMapper.readTree(json(Map.of(
                "id", "cs_test_1", "status", "complete", "payment_status", "paid", "amount_total", cents, "currency", "eur"))));
        shopService.releaseExpired();
        assertThat(orderRepository.findByCodeIgnoreCase(code).orElseThrow().getPaymentState().name()).isEqualTo("PAID");
    }


    @Test
    void pendingLimitsApplySeparatelyToNormalizedEmailAndClientIp() throws Exception {
        when(stripe.createCheckoutSession(anyString(), anyString(), anyString(), anyList(), any()))
                .thenAnswer(a -> new StripeClient.Session("cs_" + java.util.UUID.randomUUID().toString().replace("-", ""), "https://checkout.stripe.test/x"));
        assertThat(checkout("1070", "2026-12-02", 1, "Eva@example.com", "10.9.1.1").getResponse().getStatus()).isEqualTo(200);
        assertThat(checkout("1070", "2026-12-09", 1, "eva@example.com", "10.9.1.2").getResponse().getStatus()).isEqualTo(200);
        var emailLimit = checkout("1070", "2026-12-16", 1, "EVA@example.com", "10.9.1.3");
        assertThat(emailLimit.getResponse().getStatus()).isEqualTo(429);
        assertThat(emailLimit.getResponse().getContentAsString()).contains("PENDING_CHECKOUT_LIMIT");
        assertThat(checkout("1070", "2026-12-16", 1, "other@example.com", "10.9.1.1").getResponse().getStatus()).isEqualTo(200);
        var ipLimit = checkout("1070", "2026-12-16", 1, "third@example.com", "10.9.1.1");
        assertThat(ipLimit.getResponse().getStatus()).isEqualTo(429);
        assertThat(ipLimit.getResponse().getContentAsString()).contains("PENDING_CHECKOUT_LIMIT");
    }

    @Test
    void expiryClosesStripeAndReleasesStockAtApplicationDeadline() throws Exception {
        int before = inventoryRepository.findAll().stream().filter(i -> i.getItemKind() == com.artwithgab.awg_tracking.enums.ItemKind.CUSTOM && i.getCustomColor() == com.artwithgab.awg_tracking.enums.CustomColor.RED && i.getCustomFinish() == com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).findFirst().orElseThrow().getQuantity();
        String code = read(checkout("1070", "2026-12-02", 1), "$.orderCode");
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        assertThat(order.getCheckoutExpiresAt()).isEqualTo(java.time.Instant.parse("2026-11-24T08:15:00Z"));
        org.mockito.Mockito.verify(stripe).createCheckoutSession(anyString(), anyString(), anyString(), anyList(), org.mockito.ArgumentMatchers.argThat(t -> !t.isBefore(java.time.Instant.parse("2026-11-24T08:30:00Z"))));
        order.setCheckoutExpiresAt(java.time.Instant.parse("2026-11-24T07:59:59Z"));
        orderRepository.saveAndFlush(order);
        shopService.releaseExpired();
        assertThat(orderRepository.findByCodeIgnoreCase(code)).isEmpty();
        assertThat(inventoryRepository.findAll().stream().filter(i -> i.getItemKind() == com.artwithgab.awg_tracking.enums.ItemKind.CUSTOM && i.getCustomColor() == com.artwithgab.awg_tracking.enums.CustomColor.RED && i.getCustomFinish() == com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).findFirst().orElseThrow().getQuantity()).isEqualTo(before);
        org.mockito.Mockito.verify(stripe).expireOrReconcile("cs_test_1");
    }

    @Test
    void cleanupKeepsReservationWhenStripeCannotBeReconciled() throws Exception {
        String code = read(checkout("1070", "2026-12-02", 1), "$.orderCode");
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        order.setCheckoutExpiresAt(java.time.Instant.parse("2026-11-24T07:59:59Z"));
        orderRepository.saveAndFlush(order);
        when(stripe.expireOrReconcile("cs_test_1")).thenThrow(new StripeClient.PaymentProviderException());
        shopService.releaseExpired();
        assertThat(orderRepository.findByCodeIgnoreCase(code).orElseThrow().getCheckoutStatus()).isEqualTo(com.artwithgab.awg_tracking.enums.CheckoutStatus.PENDING);
    }

    @Test
    void stripeFailureLeavesNoUploadedFiles() throws Exception {
        when(stripe.createCheckoutSession(anyString(), anyString(), anyString(), anyList(), any()))
                .thenThrow(new StripeClient.PaymentProviderException());
        java.nio.file.Path dir = java.nio.file.Path.of(props.uploads().dir());
        long before = java.nio.file.Files.exists(dir) ? countFiles(dir) : 0;
        MvcResult res = checkout("1070", "2026-12-02", 1);
        assertThat(res.getResponse().getStatus()).isEqualTo(502);
        // DB rows roll back with the request transaction (not observable here: tests run inside one);
        // files on disk are not transactional, so they must be cleaned up explicitly.
        assertThat(java.nio.file.Files.exists(dir) ? countFiles(dir) : 0).isEqualTo(before);
    }

    private static long countFiles(java.nio.file.Path dir) throws java.io.IOException {
        try (var s = java.nio.file.Files.walk(dir)) {
            return s.filter(java.nio.file.Files::isRegularFile).count();
        }
    }

    @Test
    void staffCannotChangePaymentOfAPendingWebOrder() throws Exception {
        String code = read(checkout("1070", "2026-12-02", 1), "$.orderCode");
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        mvc.perform(patch("/api/orders/" + order.getId() + "/payment-state").header("Authorization", bearer(login()))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("state", "paid", "method", "cash"))))
                .andExpect(status().isConflict());
    }

    @Test
    void trackAddressMustStayInVienna() throws Exception {
        MvcResult res = checkout("1070", "2026-12-02", 1);
        String code = read(res, "$.orderCode");
        String token = read(res, "$.formToken");
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        webhook("checkout.session.completed", "paid", order.getTotal().movePointRight(2).longValueExact());
        mvc.perform(withIp(patch("/api/track/" + code + "/address")).header("X-Form-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("line1", "Hauptplatz 1", "city", "Linz", "postalCode", "4020"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pendingAndReviewWebOrdersRejectPublicWritesWithStableCode() throws Exception {
        MvcResult res = checkout("1070", "2026-12-02", 1);
        String code = read(res, "$.orderCode");
        String token = read(res, "$.formToken");
        var order = orderRepository.findByCodeIgnoreCase(code).orElseThrow();
        String originalName = order.getCustomer().getName();
        for (var state : List.of(com.artwithgab.awg_tracking.enums.CheckoutStatus.PENDING, com.artwithgab.awg_tracking.enums.CheckoutStatus.REVIEW)) {
            order.setCheckoutStatus(state);
            mvc.perform(withIp(patch("/api/track/" + code + "/address")).header("X-Form-Token", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("line1", "New address 1", "city", "Wien", "postalCode", "1010"))))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_PENDING"));
            var payload = Map.of("customerName", "Changed Name", "phone", "+43 660 1234567", "email", "changed@example.com",
                    "items", List.of(Map.of("orderItemId", order.getOrderItems().getFirst().getId(), "petName", "", "backName", "LUNA",
                            "photos", List.of(Map.of("id", "p1", "name", "photo.jpg")))));
            mvc.perform(withIp(multipart("/api/forms/" + token)).file(new MockMultipartFile("payload", "payload", "application/json", json(payload).getBytes())))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_PENDING"));
            mvc.perform(withIp(get("/api/forms/" + token))).andExpect(status().isOk()).andExpect(jsonPath("$.editable").value(false));
            assertThat(order.getCustomer().getName()).isEqualTo(originalName);
        }
    }

    @Test
    void oversizedWebhookReturnsStableTooLargeCode() throws Exception {
        mvc.perform(post("/api/shop/stripe/webhook").header("Stripe-Signature", "signature")
                        .contentType(MediaType.APPLICATION_JSON).content(new byte[256 * 1024 + 1]))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("TOO_LARGE"));
        org.mockito.Mockito.verify(stripe, org.mockito.Mockito.never()).verifySignature(anyString(), any());
    }
}
