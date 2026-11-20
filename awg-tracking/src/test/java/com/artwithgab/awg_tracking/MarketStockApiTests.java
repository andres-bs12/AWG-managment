package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real H2/API tests; fixtures do not depend on the Flyway/demo stock seed. */
class MarketStockApiTests extends ApiTestSupport {
    @Autowired JdbcTemplate jdbc;
    @Autowired InventoryRepository inventory;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired jakarta.persistence.EntityManagerFactory entityManagerFactory;
    @Autowired com.artwithgab.awg_tracking.service.MarketStockService stockService;

    private void piece(String id, String state) {
        jdbc.update("insert into market_ornament (id, status, revision) values (?, ?, 0)", id, state);
    }
    private void change(String token, String id, String state, int revision, int http, String code) throws Exception {
        var response = mvc.perform(patch("/api/market-stock/" + id).header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("status", state, "revision", revision))))
                .andExpect(status().is(http));
        if (code != null) response.andExpect(jsonPath("$.code").value(code));
    }
    private MvcResult upload(String token, String id, byte[] bytes, int revision) throws Exception {
        return mvc.perform(multipart("/api/market-stock/" + id + "/photo")
                .file(new MockMultipartFile("photo", "photo.jpg", "image/jpeg", bytes)).param("revision", "" + revision)
                .header("Authorization", bearer(token)).with(r -> { r.setMethod("PUT"); return r; })).andReturn();
    }
    private static byte[] jpeg() throws Exception {
        var out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "jpeg", out);
        return out.toByteArray();
    }
    private Map<String, Object> numbered(String id) {
        var row = new LinkedHashMap<String, Object>();
        row.put("kind", "finished"); row.put("withName", false); row.put("deliveryKind", "market");
        if (id != null) row.put("marketOrnamentId", id);
        return row;
    }

    @Test void listsExplicitFixturesWithoutMigrationSeed() throws Exception {
        String token = login();
        piece("WS99", "painted"); piece("CM99", "unpainted");
        mvc.perform(get("/api/market-stock").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id=='CM99' || @.id=='WS99')]").value(hasSize(2)))
                .andExpect(jsonPath("$[?(@.id=='CM99')].id").value(contains("CM99")))
                .andExpect(jsonPath("$[?(@.id=='CM99')].revision").value(contains(0)))
                .andExpect(jsonPath("$[?(@.id=='CM99')].soldAt").value(contains(nullValue())))
                .andExpect(jsonPath("$[?(@.id=='CM99')].orderId").value(contains(nullValue())))
                .andExpect(jsonPath("$[?(@.id=='CM99')].orderCode").value(contains(nullValue())))
                .andExpect(jsonPath("$[?(@.id=='CM99')].hasUploadedPhoto").value(contains(false)));
    }
    @Test void statusTransitionsUseRevisionsAndNeverSellFromStock() throws Exception {
        piece("RM99", "unpainted"); String token = login();
        change(token, "RM99", "painted", 0, 200, null);
        change(token, "RM99", "unpainted", 0, 409, "MARKET_STOCK_CHANGED");
        change(token, "RM99", "painted", 1, 200, null);
        change(token, "RM99", "sold", 1, 400, "MARKET_STOCK_SELL_IN_SALE");
        change(token, "RM99", "unpainted", 1, 200, null);
        assertThat(jdbc.queryForObject("select revision from market_ornament where id='RM99'", Integer.class)).isEqualTo(2);
        change(token, "RM99", "invalid", 2, 400, "VALIDATION");
        change(token, "RM99", "painted", -1, 400, "VALIDATION");
        change(token, "XX99", "painted", 0, 404, "NOT_FOUND");
    }
    @Test void photosRoundTripUpToFiveMiBAndRejectStaleRevisions() throws Exception {
        piece("RM99", "painted"); String token = login();
        byte[] large = Arrays.copyOf(jpeg(), 5 * 1024 * 1024);
        var saved = upload(token, "RM99", large, 0);
        assertThat(saved.getResponse().getStatus()).as(saved.getResponse().getContentAsString()).isEqualTo(200);
        assertThat((Boolean) read(saved, "$.hasUploadedPhoto")).isTrue();
        mvc.perform(get("/api/market-stock/RM99/photo").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.url").value("data:image/jpeg;base64," + java.util.Base64.getEncoder().encodeToString(large)));
        var stale = upload(token, "RM99", jpeg(), 0);
        assertThat(stale.getResponse().getStatus()).isEqualTo(409);
        assertThat((String) read(stale, "$.code")).isEqualTo("MARKET_STOCK_CHANGED");
    }
    @Test void rejectsOversizedEmptyWrongTypeAndUndecodablePhotosWithoutWriting() throws Exception {
        piece("RM99", "painted"); String token = login();
        var png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "png", png);
        for (byte[] invalid : new byte[][]{new byte[0], new byte[5 * 1024 * 1024 + 1], png.toByteArray(),
                new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0, 0}})
            assertThat(upload(token, "RM99", invalid, 0).getResponse().getStatus()).isEqualTo(400);
        assertThat(jdbc.queryForObject("select revision from market_ornament where id='RM99'", Integer.class)).isZero();
        mvc.perform(get("/api/market-stock/RM99/photo").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.url").value(nullValue()));
        mvc.perform(get("/api/market-stock/XX99/photo").header("Authorization", bearer(token))).andExpect(status().isNotFound());
    }
    @Test void saleLinksPieceAndDoesNotUseGenericInventory() throws Exception {
        piece("RM99", "painted");
        var generic = inventory.findFirstByItemKind(ItemKind.GENERIC).orElseThrow();
        generic.setQuantity(0); inventory.flush();
        String token = login(); var created = sale(token, numbered("RM99"));
        assertThat(created.getResponse().getStatus()).as(created.getResponse().getContentAsString()).isEqualTo(201);
        String id = read(created, "$.id"); String code = read(created, "$.code");
        mvc.perform(get("/api/orders/" + id + "/bundle").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].marketOrnamentId").value("RM99"));
        mvc.perform(get("/api/market-stock").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id=='RM99')].status").value(contains("sold")))
                .andExpect(jsonPath("$[?(@.id=='RM99')].soldAt").value(contains("2026-11-24T08:00:00Z")))
                .andExpect(jsonPath("$[?(@.id=='RM99')].orderId").value(contains(id)))
                .andExpect(jsonPath("$[?(@.id=='RM99')].orderCode").value(contains(code)));
        assertThat(inventory.findById(generic.getId()).orElseThrow().getQuantity()).isZero();
        var repeated = sale(token, numbered("RM99"));
        assertThat(repeated.getResponse().getStatus()).isEqualTo(409);
        assertThat((String) read(repeated, "$.code")).isEqualTo("MARKET_STOCK_SOLD");
    }
    @Test void rejectsMissingDuplicateAndCustomPieceIds() throws Exception {
        piece("RM99", "painted"); String token = login();
        for (String missing : new String[]{null, "", " "}) {
            var res = sale(token, numbered(missing));
            assertThat(res.getResponse().getStatus()).isEqualTo(400);
            assertThat((String) read(res, "$.field")).isEqualTo("marketOrnamentId");
        }
        var duplicate = sale(token, numbered("RM99"), numbered("RM99"));
        assertThat(duplicate.getResponse().getStatus()).isEqualTo(400);
        assertThat((String) read(duplicate, "$.field")).isEqualTo("marketOrnamentId");
        var custom = customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0);
        custom.put("marketOrnamentId", "RM99");
        var res = sale(token, custom);
        assertThat(res.getResponse().getStatus()).isEqualTo(400);
        assertThat((String) read(res, "$.field")).isEqualTo("marketOrnamentId");
        assertThat(jdbc.queryForObject("select status from market_ornament where id='RM99'", String.class)).isEqualTo("painted");
    }
    @Test void rejectsUnpaintedAndUnknownPieces() throws Exception {
        piece("RM99", "unpainted"); String token = login();
        var res = sale(token, numbered("RM99"));
        assertThat(res.getResponse().getStatus()).isEqualTo(409);
        assertThat((String) read(res, "$.code")).isEqualTo("MARKET_STOCK_NOT_READY");
        assertThat(sale(token, numbered("XX99")).getResponse().getStatus()).isEqualTo(404);
    }
    @Test void soldPieceCannotChangeStatusOrPhoto() throws Exception {
        piece("RM99", "painted"); String token = login(); saleOk(token, numbered("RM99"));
        for (String state : new String[]{"painted", "unpainted", "sold"})
            change(token, "RM99", state, 1, 400, "MARKET_STOCK_SELL_IN_SALE");
        assertThat(upload(token, "RM99", jpeg(), 1).getResponse().getStatus()).isEqualTo(400);
    }
    @Test void staleClientEditingPieceSoldAfterReadGetsConflict() throws Exception {
        piece("RM99", "painted"); String token = login();
        saleOk(token, numbered("RM99"));
        change(token, "RM99", "unpainted", 0, 409, "MARKET_STOCK_CHANGED");
        change(token, "RM99", "sold", 0, 400, "MARKET_STOCK_SELL_IN_SALE");
        var stalePhoto = upload(token, "RM99", jpeg(), 0);
        assertThat(stalePhoto.getResponse().getStatus()).isEqualTo(409);
        assertThat((String) read(stalePhoto, "$.code")).isEqualTo("MARKET_STOCK_CHANGED");
    }
    @Test void cancelRestoresOnceAndResaleShowsOnlyCurrentOrder() throws Exception {
        piece("RM99", "painted"); String token = login(); String first = saleOk(token, numbered("RM99"));
        for (int n = 0; n < 2; n++) mvc.perform(post("/api/orders/" + first + "/cancel").header("Authorization", bearer(token)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/market-stock").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$[?(@.id=='RM99')].status").value(contains("painted")))
                .andExpect(jsonPath("$[?(@.id=='RM99')].revision").value(contains(2)))
                .andExpect(jsonPath("$[?(@.id=='RM99')].soldAt").value(contains(nullValue())))
                .andExpect(jsonPath("$[?(@.id=='RM99')].orderId").value(contains(nullValue())));
        mvc.perform(get("/api/orders/" + first + "/bundle").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.items[0].marketOrnamentId").value("RM99"));
        String second = saleOk(token, numbered("RM99"));
        mvc.perform(post("/api/orders/" + first + "/cancel").header("Authorization", bearer(token))).andExpect(status().isNoContent());
        mvc.perform(get("/api/market-stock").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$[?(@.id=='RM99')].orderId").value(hasSize(1)))
                .andExpect(jsonPath("$[?(@.id=='RM99')].orderId").value(contains(second)));
    }
    @Test void listLoadsCurrentOrderLinksInTwoQueriesRegardlessOfStockSize() throws Exception {
        String token = login();
        for (String id : new String[]{"RS99", "RM99", "CS99", "WS99"}) {
            piece(id, "painted");
            saleOk(token, numbered(id));
        }
        entityManager.flush();
        entityManager.clear();
        var statistics = entityManagerFactory.unwrap(org.hibernate.SessionFactory.class).getStatistics();
        boolean enabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        statistics.clear();
        try {
            var list = stockService.list();
            assertThat(list.stream().filter(o -> java.util.Set.of("RS99", "RM99", "CS99", "WS99").contains(o.id())))
                    .hasSize(4).allSatisfy(o -> {
                        assertThat(o.orderId()).isNotBlank();
                        assertThat(o.orderCode()).startsWith("AWG");
                    });
            assertThat(statistics.getPrepareStatementCount()).isEqualTo(2);
        } finally { statistics.setStatisticsEnabled(enabled); }
    }

    @Test void everyStockRouteRequiresStaff() throws Exception {
        mvc.perform(get("/api/market-stock")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/market-stock/RM99/photo")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/market-stock/RM99").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("status", "painted", "revision", 0)))).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/market-stock/RM99/photo").file(new MockMultipartFile("photo", jpeg()))
                .param("revision", "0").with(r -> { r.setMethod("PUT"); return r; })).andExpect(status().isUnauthorized());
    }
}
