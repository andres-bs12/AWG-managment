package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SecurityCorsTests extends ApiTestSupport {
    @Test
    void staffSalePreflightAllowsIdempotencyKeyFromConfiguredOrigin() throws Exception {
        mvc.perform(options("/api/orders")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "authorization,content-type,idempotency-key"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Headers", "authorization, content-type, idempotency-key"));
    }

    @Test
    void preflightStillRejectsUnconfiguredOrigin() throws Exception {
        mvc.perform(options("/api/orders")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "idempotency-key"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void preflightStillRejectsUnapprovedHeader() throws Exception {
        mvc.perform(options("/api/orders")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "X-Unapproved-Header"))
                .andExpect(status().isForbidden());
    }
}
