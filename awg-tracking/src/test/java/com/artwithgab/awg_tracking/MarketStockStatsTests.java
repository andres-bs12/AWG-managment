package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CheckoutStatus;
import com.artwithgab.awg_tracking.enums.OrderSource;
import com.artwithgab.awg_tracking.model.MarketOrnament;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MarketStockStatsTests extends ApiTestSupport {
    @Autowired OrderRepository orders;
    private static final Instant IN_RANGE = Instant.parse("2026-12-04T12:00:00Z");

    private UUID sold(String token, String id) throws Exception {
        var piece = new MarketOrnament(); piece.setId(id); piece.setStatus("painted");
        marketStock.saveAndFlush(piece);
        var item = Map.<String, Object>of("kind", "finished", "withName", false, "deliveryKind", "market", "marketOrnamentId", id);
        UUID orderId = UUID.fromString(saleOk(token, item));
        orders.findById(orderId).orElseThrow().setCreatedAt(IN_RANGE);
        return orderId;
    }

    @Test void groupsAllNumberedColorsAndFinishesAndExcludesCancelledPendingReviewLegacyAndOtherDates() throws Exception {
        String token = login();
        for (String id : List.of("RS98", "RM98", "RM97", "WS98", "WM98", "GS98", "GM98", "CS98", "CM98")) sold(token, id);
        UUID cancelled = sold(token, "RM96");
        mvc.perform(post("/api/orders/" + cancelled + "/cancel").header("Authorization", bearer(token))).andExpect(status().isNoContent());
        for (var state : List.of(CheckoutStatus.PENDING, CheckoutStatus.REVIEW)) {
            var order = orders.findById(sold(token, state == CheckoutStatus.PENDING ? "RM95" : "RM94")).orElseThrow();
            order.setSource(OrderSource.WEB); order.setCheckoutStatus(state);
        }
        var legacy = orders.findById(sold(token, "RM93")).orElseThrow();
        legacy.getOrderItems().getFirst().setMarketOrnament(null);
        orders.findById(sold(token, "RM92")).orElseThrow().setCreatedAt(IN_RANGE.minusSeconds(86400));
        orders.flush();

        var result = mvc.perform(get("/api/stats").header("Authorization", bearer(token))
                .param("from", "2026-12-04").param("to", "2026-12-04"))
                .andExpect(status().isOk()).andReturn();
        List<Map<String, Object>> rows = read(result, "$.marketSales");
        assertThat(rows).hasSize(8);
        assertThat(rows.getFirst()).containsEntry("color", "red").containsEntry("finish", "matte").containsEntry("count", 2);
        var counts = new LinkedHashMap<String, Integer>();
        for (var row : rows) counts.put(row.get("color") + "/" + row.get("finish"), (Integer) row.get("count"));
        assertThat(counts).containsExactlyInAnyOrderEntriesOf(Map.of("red/matte", 2, "red/shiny", 1, "wine/shiny", 1,
                "wine/matte", 1, "green/shiny", 1, "green/matte", 1, "beige/shiny", 1, "beige/matte", 1));
        assertThat((Integer) read(result, "$.sales.finished")).isEqualTo(10); // includes legacy, same exclusions
        assertThat((Integer) read(result, "$.sales.cancelled")).isEqualTo(1);
        assertThat((Integer) read(result, "$.sales.checkoutsInProgress")).isEqualTo(2);
    }
}
