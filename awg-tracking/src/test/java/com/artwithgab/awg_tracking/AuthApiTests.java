package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.emptyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthApiTests extends ApiTestSupport {

    @Test
    void loginSucceedsAndTokenOpensProtectedEndpoint() throws Exception {
        String token = login();
        mvc.perform(get("/api/staff/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("gaby@artwithgab.com"));
    }

    @Test
    void loginReturnsTokenAndUser() throws Exception {
        mvc.perform(withIp(post("/api/staff/login")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "Gaby@ArtWithGab.com", "password", PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value(not(emptyString())))
                .andExpect(jsonPath("$.user.name").value("Gaby"));
    }

    @Test
    void wrongPasswordIs401() throws Exception {
        mvc.perform(withIp(post("/api/staff/login")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "gaby@artwithgab.com", "password", "nope"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Wrong e-mail or password."));
    }

    @Test
    void protectedEndpointWithoutTokenIs401() throws Exception {
        mvc.perform(get("/api/orders/00000000-0000-0000-0000-000000000000"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/agenda/days")).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutInvalidatesToken() throws Exception {
        String token = login();
        mvc.perform(post("/api/staff/logout").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/staff/me").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void failedLoginsFromOtherClientsDoNotLockOutAnAccount() throws Exception {
        // A separate account so the other tests' Gaby logins stay unaffected.
        Map<String, String> body = Map.of("email", "Rotating@ArtWithGab.com", "password", "wrong");
        for (int i = 1; i <= 21; i++) {
            mvc.perform(withIp(post("/api/staff/login")).contentType(MediaType.APPLICATION_JSON).content(json(body)))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(withIp(post("/api/staff/login")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "gaby@artwithgab.com", "password", PASSWORD))))
                .andExpect(status().isOk());
    }

    @Test
    void eleventhLoginAttemptFromSameIpIs429() throws Exception {
        String ip = freshIp();
        for (int i = 1; i <= 10; i++) {
            mvc.perform(post("/api/staff/login").with(r -> {
                        r.setRemoteAddr(ip);
                        return r;
                    }).contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("email", "gaby@artwithgab.com", "password", "wrong"))))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/staff/login").with(r -> {
                    r.setRemoteAddr(ip);
                    return r;
                }).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "gaby@artwithgab.com", "password", "wrong"))))
                .andExpect(status().isTooManyRequests());
    }
}
