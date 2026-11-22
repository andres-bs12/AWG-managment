package com.artwithgab.awg_tracking;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Remote MCP server: OAuth 2.1 connector flow, token enforcement and each tool. */
@TestPropertySource(properties = {
        "awg.mcp.enabled=true",
        "awg.mcp.public-url=https://awg.test",
        "awg.mcp.allowed-redirect-uris=https://claude.ai/api/mcp/auth_callback",
        "awg.mcp.allowed-emails=gaby@artwithgab.com",
        // Own in-memory database: a second Spring context must not recreate the schema the shared "awg" tests use.
        "spring.datasource.url=jdbc:h2:mem:awgMcp;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"
})
class McpServerApiTests extends ApiTestSupport {
    private static final String CALLBACK = "https://claude.ai/api/mcp/auth_callback";
    private static final String VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXkverifier";
    private static int rpcId = 1;

    // ---- authentication ------------------------------------------------------------------

    @Test
    void mcpWithoutTokenIs401WithResourceMetadataPointer() throws Exception {
        mvc.perform(post("/mcp").contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                        .content(rpc("tools/list", Map.of())))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate",
                        "Bearer resource_metadata=\"https://awg.test/.well-known/oauth-protected-resource/mcp\""));
    }

    @Test
    void mcpWithUnknownTokenIs401() throws Exception {
        mvc.perform(post("/mcp").header("Authorization", bearer("not-a-session")).contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM).content(rpc("tools/list", Map.of())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void discoveryDocumentsPointToThisServer() throws Exception {
        mvc.perform(get("/.well-known/oauth-protected-resource/mcp"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource").value("https://awg.test/mcp"))
                .andExpect(jsonPath("$.authorization_servers[0]").value("https://awg.test"));
        mvc.perform(get("/.well-known/oauth-authorization-server"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token_endpoint").value("https://awg.test/oauth/token"))
                .andExpect(jsonPath("$.code_challenge_methods_supported[0]").value("S256"));
    }

    @Test
    void fullOAuthFlowGivesATokenThatOpensMcp() throws Exception {
        String clientId = register();
        mvc.perform(get("/oauth/authorize").params(toParams(authorizeParams(clientId))))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy", containsString("form-action 'self' https://claude.ai")))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(containsString("Connect Claude to ArtWithGab")));

        String code = authorize(clientId, PASSWORD);
        String token = exchange(clientId, code, VERIFIER).andExpect(status().isOk())
                .andExpect(jsonPath("$.token_type").value("Bearer"))
                .andExpect(jsonPath("$.expires_in").value(7 * 24 * 3600))
                .andReturn().getResponse().getContentAsString();
        String accessToken = JsonPath.read(token, "$.access_token");

        String init = mcp(accessToken, "initialize", Map.of("protocolVersion", "2025-06-18", "capabilities", Map.of(),
                "clientInfo", Map.of("name", "test", "version", "1")));
        assertThat((String) JsonPath.read(init, "$.result.serverInfo.name")).isEqualTo("artwithgab");

        List<String> names = JsonPath.read(mcp(accessToken, "tools/list", Map.of()), "$.result.tools[*].name");
        assertThat(names).contains("search_orders", "get_order", "get_agenda_day", "list_market_stock", "list_inventory",
                "list_markets", "list_needs_attention", "create_market", "add_market_day", "get_customer_contact", "delete_market_day", "list_recent_orders", "set_painting_hours", "record_stock_sale");
        // The only deletion is an empty market day; no payments, cancellations or other deletes.
        assertThat(names).noneMatch(n -> n.contains("cancel") || n.contains("refund") || n.contains("payment")
                || (n.contains("delete") && !n.equals("delete_market_day")));
    }

    @Test
    void wrongPasswordShowsTheFormAgainWithoutACode() throws Exception {
        String clientId = register();
        Map<String, String> form = authorizeParams(clientId);
        form.put("email", "gaby@artwithgab.com");
        form.put("password", "wrong-password");
        mvc.perform(withIp(post("/oauth/authorize")).contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isUnauthorized())
                .andExpect(header().doesNotExist("Location"));
    }

    @Test
    void codeNeedsTheRightVerifierAndWorksOnlyOnce() throws Exception {
        String clientId = register();
        String code = authorize(clientId, PASSWORD);
        exchange(clientId, code, "x".repeat(50)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_grant"));
        // A rejected attempt burns the code.
        exchange(clientId, code, VERIFIER).andExpect(status().isBadRequest());

        String second = authorize(clientId, PASSWORD);
        exchange(clientId, second, VERIFIER).andExpect(status().isOk());
        exchange(clientId, second, VERIFIER).andExpect(status().isBadRequest());
    }

    @Test
    void unknownRedirectUriIsRefusedEverywhere() throws Exception {
        mvc.perform(withIp(post("/oauth/register")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("redirect_uris", List.of("https://evil.example/callback")))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_redirect_uri"));
        Map<String, String> params = authorizeParams("awg-mcp-test");
        params.put("redirect_uri", "https://evil.example/callback");
        mvc.perform(get("/oauth/authorize").params(toParams(params))).andExpect(status().isBadRequest());
        params.put("email", "gaby@artwithgab.com");
        params.put("password", PASSWORD);
        mvc.perform(withIp(post("/oauth/authorize")).contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(params)))
                .andExpect(status().isBadRequest())
                .andExpect(header().doesNotExist("Location"));
    }

    @Test
    void authorizeWithoutPkceIsRefused() throws Exception {
        Map<String, String> params = authorizeParams("awg-mcp-test");
        params.remove("code_challenge");
        mvc.perform(get("/oauth/authorize").params(toParams(params))).andExpect(status().isBadRequest());
    }

    // ---- read tools ----------------------------------------------------------------------

    @Test
    void searchAndGetOrderHideCapabilityTokens() throws Exception {
        String app = login();
        String token = mcpToken();
        String orderId = saleOk(app, customItem(false, TUE, 10.0, 11.0, "market", dayId(app, SAT), 14.0));
        String code = JsonPath.read(mvc.perform(get("/api/orders/" + orderId).header("Authorization", bearer(app)))
                .andReturn().getResponse().getContentAsString(), "$.code");

        String found = toolText(token, "search_orders", Map.of("query", code));
        assertThat(found).contains(code);

        String order = toolText(token, "get_order", Map.of("code", code));
        assertThat((String) JsonPath.read(order, "$.order.code")).isEqualTo(code);
        assertThat(order).doesNotContain("trackToken").doesNotContain("formToken");
    }

    @Test
    void marketStockFiltersByColourDecodedFromTheId() throws Exception {
        String token = mcpToken();
        String red = readyMarketPiece(); // RS..., red shiny, painted
        String reds = toolText(token, "list_market_stock", Map.of("color", "red", "status", "painted"));
        assertThat(reds).contains(red);
        assertThat((Integer) JsonPath.read(reds, "$.availableToSell")).isGreaterThanOrEqualTo(1);
        String wines = toolText(token, "list_market_stock", Map.of("color", "wine"));
        assertThat(wines).doesNotContain(red);

        String bad = mcp(token, "tools/call", Map.of("name", "list_market_stock", "arguments", Map.of("color", "purple")));
        assertThat((Boolean) JsonPath.read(bad, "$.result.isError")).isTrue();
    }

    @Test
    void agendaInventoryMarketsAndAttentionAnswer() throws Exception {
        String token = mcpToken();
        String agenda = toolText(token, "get_agenda_day", Map.of("date", SAT));
        assertThat((String) JsonPath.read(agenda, "$.date")).isEqualTo(SAT);
        assertThat(agenda).doesNotContain("\"marketDays\"").doesNotContain("\"email\"").doesNotContain("\"phone\"");

        String today = toolText(token, "get_agenda_day", Map.of());
        assertThat((String) JsonPath.read(today, "$.date")).isEqualTo(TUE);

        assertThat(toolText(token, "list_inventory", Map.of())).contains("quantity");
        String markets = toolText(token, "list_markets", Map.of());
        assertThat((List<?>) JsonPath.read(markets, "$[?(@.kind=='market')].days")).isNotEmpty();
        assertThat(toolText(token, "list_needs_attention", Map.of())).startsWith("[");
    }

    // ---- write tools ---------------------------------------------------------------------

    @Test
    void createMarketOnlySavesWithConfirm() throws Exception {
        String token = mcpToken();
        Map<String, Object> args = new LinkedHashMap<>(Map.of("name", "Spittelberg", "startDate", "2026-12-04",
                "finishDate", "2026-12-06", "stall", 7, "totalCost", 300,
                "days", List.of(Map.of("date", "2026-12-06", "openHour", 11, "closeHour", 20))));

        String preview = toolText(token, "create_market", args);
        assertThat(preview).startsWith("PREVIEW").contains("Spittelberg");
        assertThat(toolText(token, "list_markets", Map.of())).doesNotContain("Spittelberg");

        args.put("confirm", true);
        assertThat(toolText(token, "create_market", args)).startsWith("Created.");
        assertThat(toolText(token, "list_markets", Map.of())).contains("Spittelberg");
    }

    @Test
    void createMarketOnAMondayReturnsTheServiceError() throws Exception {
        String token = mcpToken();
        Map<String, Object> args = Map.of("name", "Montag", "startDate", "2027-01-01", "finishDate", "2027-01-10",
                "stall", 3, "days", List.of(Map.of("date", "2027-01-04", "openHour", 12, "closeHour", 18)), "confirm", true);
        String result = mcp(token, "tools/call", Map.of("name", "create_market", "arguments", args));
        assertThat((Boolean) JsonPath.read(result, "$.result.isError")).isTrue();
        assertThat(result).contains("is not a Friday, Saturday, or Sunday");
    }

    @Test
    void addMarketDayExtendsTheSeasonAfterConfirm() throws Exception {
        String token = mcpToken();
        Map<String, Object> created = new LinkedHashMap<>(Map.of("name", "Am Hof", "startDate", "2027-01-01",
                "finishDate", "2027-01-03", "stall", 2,
                "days", List.of(Map.of("date", "2027-01-02", "openHour", 12, "closeHour", 18)), "confirm", true));
        toolText(token, "create_market", created);
        String markets = toolText(token, "list_markets", Map.of());
        String marketId = ((List<String>) JsonPath.read(markets, "$[?(@.name=='Am Hof')].id")).getFirst();

        Map<String, Object> args = new LinkedHashMap<>(Map.of("marketId", marketId, "date", "2027-01-09", "openHour", 11, "closeHour", 19.5));
        String preview = toolText(token, "add_market_day", args);
        assertThat(preview).startsWith("PREVIEW").contains("season end moves").contains("11:00–19:30");

        args.put("confirm", true);
        assertThat(toolText(token, "add_market_day", args)).startsWith("Added.");
        List<String> dates = JsonPath.read(toolText(token, "list_markets", Map.of()), "$[?(@.name=='Am Hof')].days[*].date");
        assertThat(dates).containsExactlyInAnyOrder("2027-01-02", "2027-01-09");
    }

    // ---- audit fixes (2026-11-22 cross-model security review) ---------------------------

    @Test
    void connectorAndAppTokensDoNotCross() throws Exception {
        String app = login();
        mvc.perform(post("/mcp").header("Authorization", bearer(app)).contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM).content(rpc("tools/list", Map.of())))
                .andExpect(status().isUnauthorized());
        String connector = mcpToken();
        mvc.perform(get("/api/orders/attention").header("Authorization", bearer(connector)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/staff/password").header("Authorization", bearer(connector)).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("currentPassword", PASSWORD, "newPassword", "another-long-password"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void stateIsFullyEncodedInTheRedirect() throws Exception {
        String clientId = register();
        Map<String, String> form = authorizeParams(clientId);
        form.put("state", "a&injected=1 x");
        form.put("email", "gaby@artwithgab.com");
        form.put("password", PASSWORD);
        String location = mvc.perform(withIp(post("/oauth/authorize")).contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isFound()).andReturn().getResponse().getHeader("Location");
        var query = UriComponentsBuilder.fromUriString(location).build().getQueryParams();
        assertThat(query.containsKey("injected")).isFalse();
        assertThat(java.net.URLDecoder.decode(query.getFirst("state"), StandardCharsets.UTF_8)).isEqualTo("a&injected=1 x");
    }

    @Test
    void crossSiteLoginPostsAreRefused() throws Exception {
        String clientId = register();
        Map<String, String> form = authorizeParams(clientId);
        form.put("email", "gaby@artwithgab.com");
        form.put("password", PASSWORD);
        mvc.perform(withIp(post("/oauth/authorize")).header("Sec-Fetch-Site", "cross-site")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Location"));
        mvc.perform(withIp(post("/oauth/authorize")).header("Origin", "https://evil.example")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isForbidden());
        mvc.perform(withIp(post("/oauth/authorize")).header("Origin", "https://awg.test").header("Sec-Fetch-Site", "same-origin")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isFound());
    }

    @Test
    void codeRequestedForTheResourceMustBeRedeemedForIt() throws Exception {
        String clientId = register();
        String code = authorize(clientId, PASSWORD);
        mvc.perform(withIp(post("/oauth/token")).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "authorization_code").param("code", code).param("client_id", clientId)
                        .param("redirect_uri", CALLBACK).param("code_verifier", VERIFIER))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid_grant"));
    }

    @Test
    void overlongSeasonIsRefusedBeforeAnyWork() throws Exception {
        String token = mcpToken();
        String result = mcp(token, "tools/call", Map.of("name", "create_market", "arguments", Map.of("name", "Forever",
                "startDate", "2027-01-01", "finishDate", "9999-12-31", "stall", 1,
                "days", List.of(Map.of("date", "2027-01-02", "openHour", 12, "closeHour", 18)))));
        assertThat((Boolean) JsonPath.read(result, "$.result.isError")).isTrue();
        assertThat(result).contains("at most 120 days");
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.artwithgab.awg_tracking.repository.StaffSessionRepository sessions;

    @Test
    void connectorSessionSurvivesAMarketWeekendIdle() throws Exception {
        String token = mcpToken();
        login();
        var now = java.time.Instant.parse("2026-11-24T08:00:00Z");
        var byAudience = sessions.findAll().stream().collect(java.util.stream.Collectors.groupingBy(
                com.artwithgab.awg_tracking.model.StaffSession::getAudience,
                java.util.stream.Collectors.mapping(com.artwithgab.awg_tracking.model.StaffSession::getExpiresAt, java.util.stream.Collectors.toList())));
        assertThat(byAudience.get("mcp")).contains(now.plus(java.time.Duration.ofDays(7)));
        assertThat(byAudience.get("app")).allMatch(e -> !e.isAfter(now.plus(java.time.Duration.ofHours(12))));
        assertThat(token).isNotBlank();
    }

    // ---- Codex review fixes (2026-11-22) ------------------------------------------------

    @org.springframework.beans.factory.annotation.Autowired
    private com.artwithgab.awg_tracking.security.AuthService authService;
    @org.springframework.beans.factory.annotation.Autowired
    private com.artwithgab.awg_tracking.mcp.AuthorizationCodeStore codeStore;
    @org.springframework.beans.factory.annotation.Autowired
    private com.artwithgab.awg_tracking.repository.StaffUserRepository staffUsers;

    @Test
    void connectorTokensAreHashedInTheirOwnNamespace() throws Exception {
        String token = mcpToken();
        var hashes = sessions.findAll().stream().filter(s -> "mcp".equals(s.getAudience()))
                .map(com.artwithgab.awg_tracking.model.StaffSession::getTokenHash).toList();
        // A pre-V19 backend looks up SHA-256(token): it must not find the connector session.
        assertThat(hashes).doesNotContain(sha256Hex(token)).contains(sha256Hex("mcp:" + token));
    }

    @Test
    void onlyAllowedEmailsCanConnect() throws Exception {
        String clientId = register();
        Map<String, String> form = authorizeParams(clientId);
        form.put("email", "andres@artwithgab.com");
        form.put("password", "andres-test-pw");
        mvc.perform(withIp(post("/oauth/authorize")).contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Location"));
    }

    @Test
    void codeForAnAccountNotAllowedCannotBeRedeemed() throws Exception {
        String clientId = register();
        var andres = staffUsers.findByEmail("andres@artwithgab.com").orElseThrow();
        String code = codeStore.issue(clientId, CALLBACK, challenge(VERIFIER), "https://awg.test/mcp", andres.getId());
        exchange(clientId, code, VERIFIER).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid_grant"));
    }

    @Test
    void connectorSessionOfAnAccountNotAllowedCannotUseMcp() throws Exception {
        var andres = staffUsers.findByEmail("andres@artwithgab.com").orElseThrow();
        String token = authService.createSession(andres.getId(), com.artwithgab.awg_tracking.model.StaffSession.MCP);
        mvc.perform(post("/mcp").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM).content(rpc("tools/list", Map.of())))
                .andExpect(status().isForbidden());
    }

    @Test
    void oauthPostsWithAQueryStringAreRefused() throws Exception {
        String clientId = register();
        Map<String, String> form = authorizeParams(clientId);
        form.put("email", "gaby@artwithgab.com");
        mvc.perform(withIp(post("/oauth/authorize?password=" + PASSWORD)).contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isBadRequest()).andExpect(header().doesNotExist("Location"));
        String code = authorize(clientId, PASSWORD);
        mvc.perform(withIp(post("/oauth/token?code_verifier=" + VERIFIER)).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "authorization_code").param("code", code).param("client_id", clientId)
                        .param("redirect_uri", CALLBACK).param("resource", "https://awg.test/mcp"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("invalid_request"));
    }

    @Test
    void contactDataOnlyComesFromTheContactTool() throws Exception {
        String app = login();
        String token = mcpToken();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customerName", "Maria Muster");
        body.put("phone", "+43 660 1234567");
        body.put("email", "maria@example.com");
        body.put("items", List.of(customItem(false, TUE, 10.0, 11.0, "market", dayId(app, SAT), 14.0)));
        MvcResult sale = mvc.perform(post("/api/orders").header("Authorization", bearer(app)).contentType(MediaType.APPLICATION_JSON)
                .content(json(body))).andExpect(status().isCreated()).andReturn();
        String code = read(sale, "$.code");

        String order = toolText(token, "get_order", Map.of("code", code));
        String search = toolText(token, "search_orders", Map.of("query", "Muster"));
        String agenda = toolText(token, "get_agenda_day", Map.of("date", TUE));
        for (String text : List.of(order, search, agenda)) {
            assertThat(text).doesNotContain("1234567").doesNotContain("maria@example.com");
        }
        assertThat(search).contains("Maria Muster");

        String contact = toolText(token, "get_customer_contact", Map.of("code", code));
        assertThat(contact).contains("+43 660 1234567").contains("maria@example.com");
    }

    private static String sha256Hex(String value) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    // ---- delete_market_day (owner request 2026-11-22) -----------------------------------

    @Test
    void deleteMarketDayOnlyDeletesWithConfirm() throws Exception {
        String token = mcpToken();
        toolText(token, "create_market", new LinkedHashMap<>(Map.of("name", "Freyung", "startDate", "2027-01-01",
                "finishDate", "2027-01-10", "stall", 4, "confirm", true,
                "days", List.of(Map.of("date", "2027-01-02", "openHour", 12, "closeHour", 18),
                        Map.of("date", "2027-01-09", "openHour", 12, "closeHour", 18)))));
        String marketId = ((List<String>) JsonPath.read(toolText(token, "list_markets", Map.of()), "$[?(@.name=='Freyung')].id")).getFirst();

        Map<String, Object> args = new LinkedHashMap<>(Map.of("marketId", marketId, "date", "2027-01-09"));
        assertThat(toolText(token, "delete_market_day", args)).startsWith("PREVIEW").contains("Sat 9 Jan");
        assertThat((List<String>) JsonPath.read(toolText(token, "list_markets", Map.of()), "$[?(@.name=='Freyung')].days[*].date"))
                .containsExactlyInAnyOrder("2027-01-02", "2027-01-09");

        args.put("confirm", true);
        assertThat(toolText(token, "delete_market_day", args)).startsWith("Deleted.");
        assertThat((List<String>) JsonPath.read(toolText(token, "list_markets", Map.of()), "$[?(@.name=='Freyung')].days[*].date"))
                .containsExactly("2027-01-02");
    }

    @Test
    void deleteMarketDayWithOrdersIsRefusedByTheApp() throws Exception {
        String app = login();
        String token = mcpToken();
        String sat = dayId(app, SAT);
        saleOk(app, customItem(false, TUE, 10.0, 11.0, "market", sat, 14.0));
        String marketId = read(mvc.perform(get("/api/agenda/days/" + SAT).header("Authorization", bearer(app))).andReturn(), "$.market.id");

        String result = mcp(token, "tools/call", Map.of("name", "delete_market_day",
                "arguments", Map.of("marketId", marketId, "date", SAT, "confirm", true)));
        assertThat((Boolean) JsonPath.read(result, "$.result.isError")).isTrue();
        assertThat(result).contains("has orders and cannot be deleted");
        assertThat(toolText(token, "list_markets", Map.of())).contains(SAT);
    }

    @Test
    void deleteMarketDayRefusesHomeDaysAndUnknownDates() throws Exception {
        String token = mcpToken();
        String markets = toolText(token, "list_markets", Map.of());
        String homeId = ((List<String>) JsonPath.read(markets, "$[?(@.kind=='home')].id")).getFirst();
        String home = mcp(token, "tools/call", Map.of("name", "delete_market_day",
                "arguments", Map.of("marketId", homeId, "date", TUE, "confirm", true)));
        assertThat((Boolean) JsonPath.read(home, "$.result.isError")).isTrue();
        assertThat(home).contains("home painting days");

        String stallId = ((List<String>) JsonPath.read(markets, "$[?(@.kind=='market')].id")).getFirst();
        String unknown = mcp(token, "tools/call", Map.of("name", "delete_market_day",
                "arguments", Map.of("marketId", stallId, "date", "2030-01-05", "confirm", true)));
        assertThat((Boolean) JsonPath.read(unknown, "$.result.isError")).isTrue();
        assertThat(unknown).contains("does not open on");
    }

    // ---- list_recent_orders and set_painting_hours (owner request 2026-11-22) ----------

    @Test
    void recentOrdersListsTodaysSalesWithoutContactData() throws Exception {
        String app = login();
        String token = mcpToken();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customerName", "Lena Neu");
        body.put("phone", "+43 660 7654321");
        body.put("items", List.of(customItem(false, TUE, 10.0, 11.0, "market", dayId(app, SAT), 14.0)));
        String code = read(mvc.perform(post("/api/orders").header("Authorization", bearer(app)).contentType(MediaType.APPLICATION_JSON)
                .content(json(body))).andExpect(status().isCreated()).andReturn(), "$.code");

        String recent = toolText(token, "list_recent_orders", Map.of());
        assertThat((String) JsonPath.read(recent, "$.from")).isEqualTo("2026-11-23");
        assertThat(recent).contains(code).contains("Lena Neu").doesNotContain("7654321");
        assertThat(toolText(token, "list_recent_orders", Map.of("source", "web"))).doesNotContain(code);
    }

    @Test
    void paintingHoursArePreviewedThenSavedAndWarnAboutBookingsOutside() throws Exception {
        String app = login();
        String token = mcpToken();
        String orderId = saleOk(app, customItem(false, TUE, 10.0, 11.0, "market", dayId(app, SAT), 14.0));
        String code = read(mvc.perform(get("/api/orders/" + orderId).header("Authorization", bearer(app))).andReturn(), "$.code");

        Map<String, Object> args = new LinkedHashMap<>(Map.of("date", TUE, "openHour", 11.5, "closeHour", 13));
        String preview = toolText(token, "set_painting_hours", args);
        assertThat(preview).startsWith("PREVIEW").contains("11:30–13:00").contains(code).contains("outside the new hours");
        assertThat(paintingHours(app, TUE)).isNotEqualTo("11.5-13.0");

        args.put("confirm", true);
        assertThat(toolText(token, "set_painting_hours", args)).startsWith("Saved.").contains("11:30–13:00");
        assertThat(paintingHours(app, TUE)).isEqualTo("11.5-13.0");

        assertThat(toolText(token, "set_painting_hours", Map.of("date", WED, "open", false, "confirm", true))).contains("closed");
        String bad = mcp(token, "tools/call", Map.of("name", "set_painting_hours", "arguments", Map.of("date", "2026-11-20", "openHour", 10, "closeHour", 12)));
        assertThat((Boolean) JsonPath.read(bad, "$.result.isError")).isTrue();
        for (Map<String, Object> wrong : List.<Map<String, Object>>of(
                Map.of("date", "2026-11-26", "open", "false", "openHour", 10, "closeHour", 13),
                Map.of("date", "2026-11-26", "open", false, "openHour", 10, "closeHour", 13),
                Map.of("date", "2026-11-26", "openHour", 15, "closeHour", 10),
                Map.of("date", "2026-11-26", "openHour", 10.1, "closeHour", 13),
                Map.of("date", "2028-11-26", "openHour", 10, "closeHour", 13))) {
            String res = mcp(token, "tools/call", Map.of("name", "set_painting_hours", "arguments", wrong));
            assertThat((Boolean) JsonPath.read(res, "$.result.isError")).as(wrong.toString()).isTrue();
        }
    }

    private String paintingHours(String app, String date) throws Exception {
        String list = mvc.perform(get("/api/painting-days").param("from", date).param("to", date).header("Authorization", bearer(app)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(list, "$[0].openHour") + "-" + JsonPath.read(list, "$[0].closeHour");
    }

    // ---- helpers -------------------------------------------------------------------------

    /** Runs the whole connector OAuth flow and returns an MCP access token. */
    private String mcpToken() throws Exception {
        String clientId = register();
        String code = authorize(clientId, PASSWORD);
        return JsonPath.read(exchange(clientId, code, VERIFIER).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.access_token");
    }


    private String register() throws Exception {
        MvcResult res = mvc.perform(withIp(post("/oauth/register")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("client_name", "Claude", "redirect_uris", List.of(CALLBACK)))))
                .andExpect(status().isCreated()).andReturn();
        return read(res, "$.client_id");
    }

    private static Map<String, String> authorizeParams(String clientId) throws Exception {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("response_type", "code");
        p.put("client_id", clientId);
        p.put("redirect_uri", CALLBACK);
        p.put("state", "xyz-state");
        p.put("code_challenge", challenge(VERIFIER));
        p.put("code_challenge_method", "S256");
        p.put("resource", "https://awg.test/mcp");
        return p;
    }

    private String authorize(String clientId, String password) throws Exception {
        Map<String, String> form = authorizeParams(clientId);
        form.put("email", "gaby@artwithgab.com");
        form.put("password", password);
        MvcResult res = mvc.perform(withIp(post("/oauth/authorize")).contentType(MediaType.APPLICATION_FORM_URLENCODED).params(toParams(form)))
                .andExpect(status().isFound()).andReturn();
        String location = res.getResponse().getHeader("Location");
        assertThat(location).startsWith(CALLBACK + "?");
        var query = UriComponentsBuilder.fromUriString(location).build().getQueryParams();
        assertThat(query.getFirst("state")).isEqualTo("xyz-state");
        return query.getFirst("code");
    }

    private org.springframework.test.web.servlet.ResultActions exchange(String clientId, String code, String verifier) throws Exception {
        return mvc.perform(withIp(post("/oauth/token")).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .param("grant_type", "authorization_code").param("code", code).param("client_id", clientId)
                .param("redirect_uri", CALLBACK).param("code_verifier", verifier).param("resource", "https://awg.test/mcp"));
    }

    private static org.springframework.util.MultiValueMap<String, String> toParams(Map<String, String> map) {
        var params = new org.springframework.util.LinkedMultiValueMap<String, String>();
        map.forEach(params::add);
        return params;
    }

    private static String challenge(String verifier) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    private String rpc(String method, Map<String, Object> params) {
        return json(Map.of("jsonrpc", "2.0", "id", rpcId++, "method", method, "params", params));
    }

    private String mcp(String token, String method, Map<String, Object> params) throws Exception {
        MvcResult res = mvc.perform(post("/mcp").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                        .content(rpc(method, params)))
                .andExpect(status().isOk()).andReturn();
        return res.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    /** Calls a tool that must succeed and returns its first text block. */
    private String toolText(String token, String tool, Map<String, Object> args) throws Exception {
        String res = mcp(token, "tools/call", Map.of("name", tool, "arguments", args));
        Boolean isError = JsonPath.read(res, "$.result.isError");
        if (Boolean.TRUE.equals(isError)) throw new AssertionError(tool + " failed: " + res);
        return JsonPath.read(res, "$.result.content[0].text");
    }
}
