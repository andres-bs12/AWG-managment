package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.model.StaffSession;
import com.artwithgab.awg_tracking.repository.StaffSessionRepository;
import com.artwithgab.awg_tracking.security.AuthService;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Owner decision 2026-11-22: Andrés and Gaby each connect Claude from their own accounts. */
@TestPropertySource(properties = {
        "awg.mcp.enabled=true",
        "awg.mcp.public-url=https://awg.test",
        "awg.mcp.allowed-redirect-uris=https://claude.ai/api/mcp/auth_callback",
        "awg.mcp.allowed-emails=andres@artwithgab.com, Gaby@ArtWithGab.com"
})
class McpTwoUsersApiTests extends ApiTestSupport {
    private static final String CALLBACK = "https://claude.ai/api/mcp/auth_callback";
    private static final String VERIFIER = "two-users-verifier-0123456789-abcdefghijklmnopqrstuvwxyz";

    @Autowired
    private StaffSessionRepository sessions;
    @Autowired
    private AuthService authService;

    @Test
    void eachPersonGetsTheirOwnSessionBoundToTheirStaffAccount() throws Exception {
        String gaby = connect("gaby@artwithgab.com", PASSWORD);
        String andres = connect("andres@artwithgab.com", "andres-test-pw");
        assertThat(gaby).isNotEqualTo(andres);

        Map<String, String> ownerByHash = new java.util.HashMap<>();
        for (StaffSession s : sessions.findAll()) {
            if (StaffSession.MCP.equals(s.getAudience())) ownerByHash.put(s.getTokenHash(), s.getStaffUser().getEmail());
        }
        assertThat(ownerByHash.get(sha256Hex("mcp:" + gaby))).isEqualTo("gaby@artwithgab.com");
        assertThat(ownerByHash.get(sha256Hex("mcp:" + andres))).isEqualTo("andres@artwithgab.com");

        assertThat(toolsList(gaby)).isEqualTo(200);
        assertThat(toolsList(andres)).isEqualTo(200);

        // Disconnecting one person leaves the other connected.
        authService.logout(gaby);
        assertThat(toolsList(gaby)).isEqualTo(401);
        assertThat(toolsList(andres)).isEqualTo(200);
    }

    private String connect(String email, String password) throws Exception {
        String register = mvc.perform(withIp(post("/oauth/register")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("redirect_uris", List.of(CALLBACK)))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String clientId = JsonPath.read(register, "$.client_id");
        String challenge = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(MessageDigest.getInstance("SHA-256").digest(VERIFIER.getBytes(StandardCharsets.US_ASCII)));
        String location = mvc.perform(withIp(post("/oauth/authorize")).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("response_type", "code").param("client_id", clientId).param("redirect_uri", CALLBACK)
                        .param("code_challenge", challenge).param("code_challenge_method", "S256")
                        .param("resource", "https://awg.test/mcp").param("email", email).param("password", password))
                .andExpect(status().isFound()).andReturn().getResponse().getHeader("Location");
        String code = UriComponentsBuilder.fromUriString(location).build().getQueryParams().getFirst("code");
        String token = mvc.perform(withIp(post("/oauth/token")).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "authorization_code").param("code", code).param("client_id", clientId)
                        .param("redirect_uri", CALLBACK).param("code_verifier", VERIFIER).param("resource", "https://awg.test/mcp"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(token, "$.access_token");
    }

    private int toolsList(String token) throws Exception {
        return mvc.perform(post("/mcp").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"))
                .andReturn().getResponse().getStatus();
    }

    private static String sha256Hex(String value) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
