package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** With the default awg.mcp.enabled=false the MCP and OAuth endpoints do not exist, even for staff. */
class McpDisabledApiTests extends ApiTestSupport {

    @Test
    void mcpAndOAuthAreClosedByDefault() throws Exception {
        String token = login();
        mvc.perform(post("/mcp").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/oauth/token").contentType(MediaType.APPLICATION_FORM_URLENCODED).param("grant_type", "authorization_code"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/.well-known/oauth-authorization-server")).andExpect(status().isUnauthorized());
    }
}
