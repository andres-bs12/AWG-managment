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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FormTrackApiTests extends ApiTestSupport {

    private static final byte[] JPEG = TestImages.jpeg();

    private record Created(String orderId, String code, String formToken, String itemId) {
    }

    private Created customOrder(String token, String deliveryKind, String dayDate, Double pickup) throws Exception {
        return customOrder(token, deliveryKind, dayDate, pickup, 10.0);
    }

    private Created customOrder(String token, String deliveryKind, String dayDate, Double pickup, double start) throws Exception {
        String orderId = saleOk(token, customItem(true, TUE, start, start + 1.25, deliveryKind, dayId(token, dayDate), pickup));
        MvcResult order = mvc.perform(get("/api/orders/" + orderId).header("Authorization", bearer(token))).andReturn();
        MvcResult bundle = mvc.perform(get("/api/orders/" + orderId + "/bundle").header("Authorization", bearer(token))).andReturn();
        return new Created(orderId, read(order, "$.code"), read(order, "$.formToken"), read(bundle, "$.items[0].id"));
    }

    private MvcResult submit(Created c, MockMultipartFile... files) throws Exception {
        return submitNamed(c, "bella", files);
    }

    private MvcResult submitNamed(Created c, String backName, MockMultipartFile... files) throws Exception {
        Map<String, Object> payload = Map.of(
                "customerName", "Maria Muster", "phone", "+43 660 1234567", "email", "maria@example.com",
                "items", List.of(Map.of("orderItemId", c.itemId(), "petName", "Bella", "backName", backName,
                        "note", "Brown and white", "photos", List.of(Map.of("id", "p1", "name", "bella.jpg")))));
        var req = multipart("/api/forms/" + c.formToken())
                .file(new MockMultipartFile("payload", "payload", "application/json", json(payload).getBytes()));
        for (MockMultipartFile f : files) req.file(f);
        return mvc.perform(withIp(req)).andReturn();
    }

    @Test
    void rejectsLetteringThatExpandsBeyondSixOnUppercase() throws Exception {
        Created c = customOrder(login(), "market", SAT, 14.0);
        var res = submitNamed(c, "Straße", new MockMultipartFile("photo-p1", "bella.jpg", "image/jpeg", JPEG));
        assertEquals(400, res.getResponse().getStatus());
        assertEquals("VALIDATION", this.<String>read(res, "$.code"));
        assertEquals("items[0].backName", this.<String>read(res, "$.field"));
    }

    @Test
    void acceptsSixLettersAfterUppercaseExpansion() throws Exception {
        Created c = customOrder(login(), "market", SAT, 14.0);
        var res = submitNamed(c, "ßßß", new MockMultipartFile("photo-p1", "bella.jpg", "image/jpeg", JPEG));
        assertEquals(200, res.getResponse().getStatus());
        mvc.perform(withIp(get("/api/forms/" + c.formToken())))
                .andExpect(jsonPath("$.items[0].backName").value("SSSSSS"));
    }

    @Test
    void getFormByToken() throws Exception {
        Created c = customOrder(login(), "market", SAT, 14.0);
        mvc.perform(withIp(get("/api/forms/" + c.formToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCode").value(c.code()))
                .andExpect(jsonPath("$.alreadySubmitted").value(false));
    }

    @Test
    void invalidTokenIs404() throws Exception {
        mvc.perform(withIp(get("/api/forms/this-token-does-not-exist-at-all")))
                .andExpect(status().isNotFound());
    }

    @Test
    void submitStoresJpegAndServesIt() throws Exception {
        String staff = login();
        Created c = customOrder(staff, "market", SAT, 14.0);
        MvcResult res = submit(c, new MockMultipartFile("photo-p1", "bella.jpg", "image/jpeg", JPEG));
        assertEquals(200, res.getResponse().getStatus(), res.getResponse().getContentAsString());

        MvcResult bundle = mvc.perform(get("/api/orders/" + c.orderId() + "/bundle").header("Authorization", bearer(staff)))
                .andExpect(jsonPath("$.items[0].petName").value("Bella"))
                .andExpect(jsonPath("$.items[0].backName").value("BELLA"))
                .andExpect(jsonPath("$.items[0].photos.length()").value(1)).andReturn();
        String url = read(bundle, "$.items[0].photos[0].dataUrl");

        mvc.perform(get(url)) // public: no token
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andExpect(content().bytes(JPEG));
    }

    @Test
    void nonImageFileIs400() throws Exception {
        Created c = customOrder(login(), "market", SAT, 14.0);
        MvcResult res = submit(c, new MockMultipartFile("photo-p1", "evil.jpg", "image/jpeg", "<html>not an image</html>".getBytes()));
        assertEquals(400, res.getResponse().getStatus());
        assertEquals("Photos must be JPEG, PNG, WebP or HEIC images.", this.<String>read(res, "$.message"));
    }

    @Test
    void trackIsPublicByCodeAndUnknownCodeIs404() throws Exception {
        Created c = customOrder(login(), "market", SAT, 14.0);
        mvc.perform(withIp(get("/api/track/" + c.code())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(c.code()))
                .andExpect(jsonPath("$.status").value("preparing"));
        mvc.perform(withIp(get("/api/track/ZZZ999"))).andExpect(status().isNotFound());
    }

    @Test
    void addressUpdateOnlyForViennaOrdersAndNeedsFormToken() throws Exception {
        String staff = login();
        Map<String, Object> address = Map.of("line1", "Stephansplatz 1", "city", "Wien", "postalCode", "1010");

        Created market = customOrder(staff, "market", SAT, 14.0);
        mvc.perform(withIp(patch("/api/track/" + market.code() + "/address")).header("X-Form-Token", market.formToken())
                        .contentType(MediaType.APPLICATION_JSON).content(json(address)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This order is not delivered in Vienna"));

        Created vienna = customOrder(staff, "vienna", WED, null, 11.5);
        // Without the form token the short public code is not enough.
        mvc.perform(withIp(patch("/api/track/" + vienna.code() + "/address")).contentType(MediaType.APPLICATION_JSON).content(json(address)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Open the link from your order form to change the address."));
        mvc.perform(withIp(patch("/api/track/" + vienna.code() + "/address")).header("X-Form-Token", vienna.formToken())
                        .contentType(MediaType.APPLICATION_JSON).content(json(address)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.delivery.address.city").value("Wien"));
        // The address is only visible on Track with the token.
        mvc.perform(withIp(get("/api/track/" + vienna.code())).header("X-Form-Token", vienna.formToken()))
                .andExpect(jsonPath("$.delivery.address.city").value("Wien"));
        mvc.perform(withIp(get("/api/track/" + vienna.code())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.delivery.address").doesNotExist());
    }

    @Test
    void truncatedJpegIsRejected() throws Exception {
        Created c = customOrder(login(), "market", SAT, 14.0);
        byte[] cut = TestImages.truncatedJpeg();
        MvcResult res = submit(c, new MockMultipartFile("photo-p1", "bella.jpg", "image/jpeg", cut));
        assertEquals(400, res.getResponse().getStatus());
    }

    private MvcResult submitWithAddress(Created c, Map<String, Object> address) throws Exception {
        Map<String, Object> payload = new java.util.LinkedHashMap<>(Map.of(
                "customerName", "Maria Muster", "phone", "+43 660 1234567", "email", "maria@example.com",
                "items", List.of(Map.of("orderItemId", c.itemId(), "petName", "Bella", "backName", "bella",
                        "photos", List.of(Map.of("id", "p1", "name", "bella.jpg"))))));
        if (address != null) payload.put("address", address);
        var req = multipart("/api/forms/" + c.formToken())
                .file(new MockMultipartFile("payload", "payload", "application/json", json(payload).getBytes()))
                .file(new MockMultipartFile("photo-p1", "bella.jpg", "image/jpeg", JPEG));
        return mvc.perform(withIp(req)).andReturn();
    }

    @Test
    void viennaFormNeedsAnAddressInVienna() throws Exception {
        Created c = customOrder(login(), "vienna", WED, null, 11.5);
        mvc.perform(withIp(get("/api/forms/" + c.formToken())))
                .andExpect(jsonPath("$.needsAddress").value(true))
                .andExpect(jsonPath("$.editable").value(true));

        MvcResult none = submitWithAddress(c, null);
        assertEquals(400, none.getResponse().getStatus());
        assertEquals("address", this.<String>read(none, "$.field"));

        MvcResult linz = submitWithAddress(c, Map.of("line1", "Hauptplatz 1", "postalCode", "4020", "city", "Linz"));
        assertEquals(400, linz.getResponse().getStatus());
        assertEquals("POSTAL_OUTSIDE_VIENNA", this.<String>read(linz, "$.code"));

        MvcResult ok = submitWithAddress(c, Map.of("line1", "Neubaugasse 1", "postalCode", "1070", "city", "Wien"));
        assertEquals(200, ok.getResponse().getStatus(), ok.getResponse().getContentAsString());
        mvc.perform(withIp(get("/api/forms/" + c.formToken())))
                .andExpect(jsonPath("$.address.postalCode").value("1070"));
    }
}
