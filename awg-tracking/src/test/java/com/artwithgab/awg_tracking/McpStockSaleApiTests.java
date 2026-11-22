package com.artwithgab.awg_tracking;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** record_stock_sale on a market Saturday (Sat 28 Nov 2026, demo stall open 12:00–19:00). */
@TestPropertySource(properties = {
        "awg.test.clock=2026-11-28T12:00:00Z",
        "awg.mcp.enabled=true",
        "awg.mcp.public-url=https://awg.test",
        "awg.mcp.allowed-redirect-uris=https://claude.ai/api/mcp/auth_callback",
        "awg.mcp.allowed-emails=gaby@artwithgab.com"
})
class McpStockSaleApiTests extends ApiTestSupport {
    private static final String CALLBACK = "https://claude.ai/api/mcp/auth_callback";
    private static final String VERIFIER = "stock-sale-verifier-0123456789-abcdefghijklmnopqrstuvwxyz";

    @Test
    void stockSaleIsPreviewedThenSoldPaidAndHandedOver() throws Exception {
        String app = login();
        String token = connect();
        String piece = readyMarketPiece();
        String marketId = stallOpenToday(app);

        Map<String, Object> args = new LinkedHashMap<>(Map.of("ornamentId", piece, "marketId", marketId, "paymentMethod", "cash"));
        String preview = tool(token, "record_stock_sale", args, false);
        assertThat(preview).startsWith("PREVIEW").contains(piece).contains("cash").contains("Price: EUR 39.99");
        assertThat(stockStatus(app, piece)).isEqualTo("painted");

        args.put("confirm", true);
        String sold = tool(token, "record_stock_sale", args, false);
        assertThat(sold).startsWith("Sold.").contains(piece).contains("paid by cash");
        String code = sold.replaceAll("(?s).*order (\\w+).*", "$1");

        var order = mvc.perform(get("/api/orders").param("code", code).header("Authorization", bearer(app)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat((String) JsonPath.read(order, "$.paymentState")).isEqualTo("paid");
        assertThat((String) JsonPath.read(order, "$.paymentMethod")).isEqualTo("cash");
        assertThat((Boolean) JsonPath.read(order, "$.handedOver")).isTrue();
        assertThat(((Number) JsonPath.read(order, "$.amountPaid")).doubleValue())
                .isEqualTo(((Number) JsonPath.read(order, "$.total")).doubleValue());
        assertThat(stockStatus(app, piece)).isEqualTo("sold");

        // A retry (lost response) cannot sell the same piece twice.
        String again = tool(token, "record_stock_sale", args, true);
        assertThat(again).contains("is sold");
    }

    @Test
    void stockSaleNeedsAPaintedPieceAMarketOpenTodayAndCashOrCard() throws Exception {
        String app = login();
        String token = connect();
        String piece = readyMarketPiece();
        String marketId = stallOpenToday(app);

        assertThat(tool(token, "record_stock_sale", Map.of("ornamentId", piece, "marketId", marketId, "paymentMethod", "voucher", "confirm", true), true))
                .contains("cash or card");
        assertThat(tool(token, "record_stock_sale", Map.of("ornamentId", "ZZ99", "marketId", marketId, "paymentMethod", "card", "confirm", true), true))
                .contains("There is no piece");

        String other = JsonPath.read(tool(token, "create_market", Map.of("name", "Elsewhere", "startDate", "2026-12-04",
                "finishDate", "2026-12-06", "stall", 3, "confirm", true,
                "days", List.of(Map.of("date", "2026-12-05", "openHour", 11, "closeHour", 19))), false)
                .replaceFirst("(?s)^[^\\n{]*", ""), "$.market.id");
        assertThat(tool(token, "record_stock_sale", Map.of("ornamentId", piece, "marketId", other, "paymentMethod", "card", "confirm", true), true))
                .contains("is not open today");
        assertThat(stockStatus(app, piece)).isEqualTo("painted");
    }

    private String stallOpenToday(String app) throws Exception {
        String agenda = mvc.perform(get("/api/agenda/days/" + SAT).header("Authorization", bearer(app)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(agenda, "$.market.id");
    }

    private String stockStatus(String app, String piece) throws Exception {
        String list = mvc.perform(get("/api/market-stock").header("Authorization", bearer(app)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> statuses = JsonPath.read(list, "$[?(@.id=='" + piece + "')].status");
        return statuses.getFirst();
    }

    /** Returns the text blocks of a tool call joined, asserting whether it is an error. */
    private String tool(String token, String name, Map<String, Object> args, boolean expectError) throws Exception {
        String res = mvc.perform(post("/mcp").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                        .content(json(Map.of("jsonrpc", "2.0", "id", 1, "method", "tools/call",
                                "params", Map.of("name", name, "arguments", args)))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Boolean isError = JsonPath.read(res, "$.result.isError");
        assertThat(Boolean.TRUE.equals(isError)).as(res).isEqualTo(expectError);
        List<String> texts = JsonPath.read(res, "$.result.content[*].text");
        return String.join("\n", texts);
    }

    private String connect() throws Exception {
        String register = mvc.perform(withIp(post("/oauth/register")).contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("redirect_uris", List.of(CALLBACK)))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String clientId = JsonPath.read(register, "$.client_id");
        String challenge = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(MessageDigest.getInstance("SHA-256").digest(VERIFIER.getBytes(StandardCharsets.US_ASCII)));
        String location = mvc.perform(withIp(post("/oauth/authorize")).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("response_type", "code").param("client_id", clientId).param("redirect_uri", CALLBACK)
                        .param("code_challenge", challenge).param("code_challenge_method", "S256")
                        .param("resource", "https://awg.test/mcp").param("email", "gaby@artwithgab.com").param("password", PASSWORD))
                .andExpect(status().isFound()).andReturn().getResponse().getHeader("Location");
        String code = UriComponentsBuilder.fromUriString(location).build().getQueryParams().getFirst("code");
        String token = mvc.perform(withIp(post("/oauth/token")).contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "authorization_code").param("code", code).param("client_id", clientId)
                        .param("redirect_uri", CALLBACK).param("code_verifier", VERIFIER).param("resource", "https://awg.test/mcp"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(token, "$.access_token");
    }
}
