package com.artwithgab.awg_tracking;

import com.jayway.jsonpath.JsonPath;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Shared setup for the MockMvc integration tests. Fixed clock (Tue 2026-11-24 09:00 Vienna), H2 in
 * PostgreSQL mode, demo market Rathausplatz (Fri 27 Nov to Mon 21 Dec, 12:00-19:00) and home days
 * (Tue 24 10-13, Wed 25 10-12, Thu 26 10-13). Each test runs in a rolled-back transaction.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
@Transactional
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:awg;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "awg.bootstrap.demo-markets=true",
        "awg.bootstrap.staff[0].name=Gaby",
        "awg.bootstrap.staff[0].email=gaby@artwithgab.com",
        "awg.bootstrap.staff[0].password=gaby-test-pw",
        "awg.bootstrap.staff[1].name=Andres",
        "awg.bootstrap.staff[1].email=andres@artwithgab.com",
        "awg.bootstrap.staff[1].password=andres-test-pw"
})
public abstract class ApiTestSupport {

    protected static final String PASSWORD = "gaby-test-pw";
    protected static final String TUE = "2026-11-24";
    protected static final String WED = "2026-11-25";
    protected static final String SAT = "2026-11-28";
    protected static final String SUN = "2026-11-29";

    private static final AtomicInteger IP = new AtomicInteger(1);

    @DynamicPropertySource
    static void uploads(DynamicPropertyRegistry registry) throws IOException {
        var dir = Files.createTempDirectory("awg-test-uploads");
        dir.toFile().deleteOnExit();
        registry.add("awg.uploads.dir", dir::toString);
    }

    @Autowired
    protected MockMvc mvc;

    /** A fresh client address per call, because the rate limiter keys on it and the clock is frozen. */
    protected static String freshIp() {
        return "10.1." + (IP.get() / 250) + "." + (IP.getAndIncrement() % 250 + 1);
    }

    @SuppressWarnings("unchecked")
    protected static <B extends org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder<B>> B withIp(B b) {
        return b.with(r -> {
            r.setRemoteAddr(freshIp());
            return r;
        });
    }

    protected String login() throws Exception {
        MvcResult res = mvc.perform(withIp(post("/api/staff/login")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "gaby@artwithgab.com", "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(res.getResponse().getContentAsString(), "$.token");
    }

    protected static String bearer(String token) {
        return "Bearer " + token;
    }

    protected String json(Object o) {
        try {
            return new tools.jackson.databind.ObjectMapper().writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    protected <T> T read(MvcResult res, String path) throws Exception {
        return JsonPath.read(res.getResponse().getContentAsString(), path);
    }

    /** Id of the market day (stall or home) on a date. */
    protected String dayId(String token, String date) throws Exception {
        MvcResult res = mvc.perform(get("/api/market-days").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andReturn();
        List<String> ids = JsonPath.read(res.getResponse().getContentAsString(), "$[?(@.date=='" + date + "')].id");
        return ids.getFirst();
    }

    // ---- sale builders -------------------------------------------------------------------

    protected Map<String, Object> customItem(boolean withName, String paintDate, Double start, Double end,
                                             String deliveryKind, String marketDayId, Double pickupHour) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", "custom");
        m.put("withName", withName);
        m.put("color", "red");
        if (paintDate != null) m.put("paintDate", paintDate);
        if (start != null) m.put("paintStart", start);
        if (end != null) m.put("paintEnd", end);
        m.put("deliveryKind", deliveryKind);
        m.put("marketDayId", marketDayId);
        if (pickupHour != null) m.put("pickupHour", pickupHour);
        return m;
    }

    protected Map<String, Object> finishedItem() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", "finished");
        m.put("withName", false); // Jackson 3 rejects a missing primitive (see report)
        m.put("deliveryKind", "market");
        return m;
    }

    protected MvcResult sale(String token, Map<String, Object>... items) throws Exception {
        return mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("items", new ArrayList<>(List.of(items)))))).andReturn();
    }

    /** Creates a sale that must succeed and returns the order id. */
    @SafeVarargs
    protected final String saleOk(String token, Map<String, Object>... items) throws Exception {
        MvcResult res = sale(token, items);
        if (res.getResponse().getStatus() != 201) {
            throw new AssertionError("Sale failed: " + res.getResponse().getStatus() + " " + res.getResponse().getContentAsString());
        }
        return read(res, "$.id");
    }
}
