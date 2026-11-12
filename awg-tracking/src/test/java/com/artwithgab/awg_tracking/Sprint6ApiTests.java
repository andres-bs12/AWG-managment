package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.WaitlistEntry;
import com.artwithgab.awg_tracking.payment.StripeClient;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.repository.WaitlistRepository;
import com.artwithgab.awg_tracking.service.RetentionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 2026-11-05 owner answers: finishes, delivery start, form link expiry, Track for old codes, retention, waitlist opt-in. */
@TestPropertySource(properties = "awg.shop.enabled=true")
class Sprint6ApiTests extends ApiTestSupport {
    private static final byte[] JPEG = TestImages.jpeg();

    @MockitoBean StripeClient stripe;
    @Autowired OrderRepository orders;
    @Autowired InventoryRepository inventory;
    @Autowired WaitlistRepository waitlist;
    @Autowired RetentionService retention;
    @Autowired TransactionTemplate tx;
    @Autowired Clock clock;

    @BeforeEach
    void stripeOk() {
        when(stripe.isConfigured()).thenReturn(true);
        when(stripe.createCheckoutSession(anyString(), anyString(), anyString(), anyList(), any()))
                .thenAnswer(a -> new StripeClient.Session("cs_" + UUID.randomUUID(), "https://checkout.stripe.test/x"));
        when(stripe.expireOrReconcile(anyString())).thenReturn("expired");
    }

    private MvcResult checkout(String color, String finish) throws Exception {
        var item = new java.util.HashMap<String, Object>(Map.of("kind", "custom", "withName", false, "color", color, "petName", "Luna",
                "photos", List.of(Map.of("id", "p0", "name", "luna.jpg"))));
        if (finish != null) item.put("finish", finish);
        Map<String, Object> payload = Map.of("customerName", "Eva Gruber", "email", "eva@example.com", "phone", "+43 1 234",
                "address", Map.of("line1", "Neubaugasse 1", "city", "Wien", "postalCode", "1070"),
                "deliveryDate", "2026-12-02", "acceptTerms", true, "items", List.of(item));
        var req = multipart("/api/shop/checkout");
        req.file(new MockMultipartFile("photo-p0", "luna.jpg", "image/jpeg", JPEG));
        req.file(new MockMultipartFile("payload", "", "application/json", json(payload).getBytes()));
        return mvc.perform(withIp(req)).andReturn();
    }

    private int stock(CustomColor color, CustomFinish finish) {
        return inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, color, finish).orElseThrow().getQuantity();
    }

    @Test
    void shopOffersRedGreenBeigeInShinyAndMatte() throws Exception {
        MvcResult res = mvc.perform(get("/api/shop/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveriesFrom").value("2026-11-30")).andReturn();
        List<String> colors = read(res, "$.colors[*].color");
        List<String> finishes = read(res, "$.colors[*].finish");
        assertThat(colors).containsExactly("red", "red", "green", "green", "beige", "beige");
        assertThat(finishes).containsExactly("shiny", "matte", "shiny", "matte", "shiny", "matte");
    }

    @Test
    void matteCheckoutDeductsMatteStockOnly() throws Exception {
        int matte = stock(CustomColor.BEIGE, CustomFinish.MATTE);
        int shiny = stock(CustomColor.BEIGE, CustomFinish.SHINY);
        MvcResult res = checkout("beige", "matte");
        assertThat(res.getResponse().getStatus()).as(res.getResponse().getContentAsString()).isEqualTo(200);
        assertThat(stock(CustomColor.BEIGE, CustomFinish.MATTE)).isEqualTo(matte - 1);
        assertThat(stock(CustomColor.BEIGE, CustomFinish.SHINY)).isEqualTo(shiny);
    }

    @Test
    void checkoutNeedsAFinishAndAnOfferedColor() throws Exception {
        MvcResult noFinish = checkout("red", null);
        assertThat(noFinish.getResponse().getStatus()).isEqualTo(400);
        assertThat(this.<String>read(noFinish, "$.field")).isEqualTo("items[0].finish");
        MvcResult grey = checkout("grey", "shiny");
        assertThat(grey.getResponse().getStatus()).isEqualTo(400);
        assertThat(this.<String>read(grey, "$.field")).isEqualTo("items[0].color");
    }

    @Test
    void noWebDeliveryBeforeTheSeasonStarts() throws Exception {
        MvcResult res = mvc.perform(withIp(post("/api/shop/delivery-dates")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("items", List.of(Map.of("kind", "custom", "withName", false)))))).andExpect(status().isOk()).andReturn();
        List<String> dates = read(res, "$[*].date");
        assertThat(dates).isNotEmpty().allSatisfy(d -> assertThat(d).isGreaterThanOrEqualTo("2026-11-30"));
    }

    /** A finished-ornament sale marked handed over {@code daysAgo} days ago. */
    private Order handedOverOrder(int daysAgo) throws Exception {
        String id = saleOk(login(), finishedItem());
        return tx.execute(s -> {
            Order o = orders.findById(UUID.fromString(id)).orElseThrow();
            o.getCustomer().setName("Eva Gruber");
            o.getCustomer().setEmail("eva@example.com");
            o.getCustomer().setPhone("+43 1 234");
            o.setHandedOver(true);
            o.setHandedOverAt(clock.instant().minus(Duration.ofDays(daysAgo)));
            o.getOrderItems().forEach(i -> i.setPetName("Luna"));
            return o;
        });
    }

    @Test
    void formLinkExpires30DaysAfterHandover() throws Exception {
        Order fresh = handedOverOrder(29);
        mvc.perform(withIp(get("/api/forms/" + fresh.getFormToken()))).andExpect(status().isOk());
        Order old = handedOverOrder(31);
        mvc.perform(withIp(get("/api/forms/" + old.getFormToken())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("FORM_EXPIRED"));
    }

    @Test
    void handOverStampsTheTime() throws Exception {
        String token = login();
        String id = saleOk(token, finishedItem());
        mvc.perform(patch("/api/orders/" + id + "/handed-over").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true)))).andExpect(status().is2xxSuccessful());
        assertThat(orders.findById(UUID.fromString(id)).orElseThrow().getHandedOverAt()).isEqualTo(clock.instant());
    }

    @Test
    void oldShortCodesShowNoNamesWithoutTheFormToken() throws Exception {
        Order order = handedOverOrder(1);
        tx.executeWithoutResult(s -> orders.findById(order.getId()).orElseThrow().setCode("AWG4321"));
        mvc.perform(withIp(get("/api/track/AWG4321"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.customerName").value(""))
                .andExpect(jsonPath("$.items[0].petName").value(""));
        mvc.perform(withIp(get("/api/track/AWG4321")).header("X-Form-Token", order.getFormToken())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].petName").value("Luna"));
    }

    @Test
    void personalDataIsErased60DaysAfterHandover() throws Exception {
        Order keep = handedOverOrder(59);
        Order erase = handedOverOrder(61);
        String oldToken = erase.getFormToken();
        retention.run();
        tx.executeWithoutResult(s -> {
            Order kept = orders.findById(keep.getId()).orElseThrow();
            assertThat(kept.getAnonymizedAt()).isNull();
            assertThat(kept.getCustomer().getEmail()).isEqualTo("eva@example.com");
            Order erased = orders.findById(erase.getId()).orElseThrow();
            assertThat(erased.getAnonymizedAt()).isNotNull();
            assertThat(erased.getCustomer().getName()).isEqualTo("(deleted)");
            assertThat(erased.getCustomer().getEmail()).isEmpty();
            assertThat(erased.getCustomer().getPhone()).isEmpty();
            assertThat(erased.getDeliveryAddress()).isNull();
            assertThat(erased.getOrderItems()).allSatisfy(i -> assertThat(i.getPetName()).isEmpty());
            assertThat(erased.getTotal()).isPositive();
        });
        mvc.perform(withIp(get("/api/forms/" + oldToken)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("FORM_EXPIRED"));
    }

    @Test
    void cancelledPendingOrdersStillReachRetention() throws Exception {
        Order order = handedOverOrder(1);
        tx.executeWithoutResult(s -> {
            Order saved = orders.findById(order.getId()).orElseThrow();
            saved.setStatus("CANCELLED");
            saved.setCancelledAt(clock.instant());
            saved.setCancellationReason("Personal reason");
            saved.setHandedOver(false);
            saved.setHandedOverAt(null);
            saved.setSource(com.artwithgab.awg_tracking.enums.OrderSource.WEB);
            saved.setCheckoutStatus(com.artwithgab.awg_tracking.enums.CheckoutStatus.PENDING);
            saved.getOrderItems().forEach(i -> i.setHandoffDate(java.time.LocalDate.of(2024, 1, 1)));
        });
        retention.run();
        tx.executeWithoutResult(s -> {
            Order saved = orders.findById(order.getId()).orElseThrow();
            assertThat(saved.getAnonymizedAt()).isNotNull();
            assertThat(saved.getCancellationReason()).isNull();
            assertThat(saved.getStatus()).isEqualTo("CANCELLED");
        });
    }

    @Test
    void staffCannotSellColorsNoLongerOffered() throws Exception {
        String token = login();
        var item = customItem(false, null, null, null, "market", null, null);
        item.put("color", "grey");
        MvcResult res = sale(token, item);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat(this.<String>read(res, "$.field")).isEqualTo("items[0].color");
    }

    @Test
    void repeatedWaitlistSignUpsDoNotResendWithinAnHour() throws Exception {
        String email = "again-" + UUID.randomUUID() + "@example.com";
        for (int i = 0; i < 2; i++) {
            mvc.perform(withIp(post("/api/shop/waitlist")).contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", email, "locale", "en")))).andExpect(status().isNoContent());
        }
        assertThat(waitlist.findByEmail(email).orElseThrow().getLastSentAt()).isEqualTo(clock.instant());
    }

    @Test
    void waitlistNeedsConfirmationAndCanBeLeft() throws Exception {
        String email = "fan-" + UUID.randomUUID() + "@example.com";
        mvc.perform(withIp(post("/api/shop/waitlist")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", email, "locale", "de")))).andExpect(status().isNoContent());
        WaitlistEntry entry = waitlist.findByEmail(email).orElseThrow();
        assertThat(entry.getConfirmedAt()).isNull();
        assertThat(entry.getToken()).hasSizeGreaterThan(30);

        mvc.perform(withIp(post("/api/shop/waitlist/confirm")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("token", entry.getToken())))).andExpect(status().isNoContent());
        assertThat(waitlist.findByEmail(email).orElseThrow().getConfirmedAt()).isNotNull();
        mvc.perform(withIp(post("/api/shop/waitlist/confirm")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("token", "nope")))).andExpect(status().isNotFound());

        mvc.perform(withIp(post("/api/shop/waitlist/unsubscribe")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("token", entry.getToken())))).andExpect(status().isNoContent());
        assertThat(waitlist.findByEmail(email)).isEmpty();
    }

    @Test
    void unconfirmedWaitlistSignUpsAreDeletedAfterAWeek() {
        WaitlistEntry old = new WaitlistEntry();
        old.setEmail("old-" + UUID.randomUUID() + "@example.com");
        old.setLocale("de");
        old.setToken(UUID.randomUUID().toString());
        old.setCreatedAt(Instant.parse("2026-11-01T08:00:00Z"));
        waitlist.save(old);
        WaitlistEntry confirmed = new WaitlistEntry();
        confirmed.setEmail("ok-" + UUID.randomUUID() + "@example.com");
        confirmed.setLocale("de");
        confirmed.setToken(UUID.randomUUID().toString());
        confirmed.setCreatedAt(Instant.parse("2026-11-01T08:00:00Z"));
        confirmed.setConfirmedAt(Instant.parse("2026-11-01T09:00:00Z"));
        waitlist.save(confirmed);
        retention.run();
        assertThat(waitlist.findByEmail(old.getEmail())).isEmpty();
        assertThat(waitlist.findByEmail(confirmed.getEmail())).isPresent();
    }
}
