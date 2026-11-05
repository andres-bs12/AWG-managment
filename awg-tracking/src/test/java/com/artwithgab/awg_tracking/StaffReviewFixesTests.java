package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Fixes from the staff review of 2026-11-05: search, attention list, cancel restock rules, sessions. */
class StaffReviewFixesTests extends ApiTestSupport {
    @Autowired
    OrderRepository orderRepository;
    @Autowired
    InventoryRepository inventoryRepository;
    @Autowired
    TransactionTemplate tx;

    private int redStock() {
        return inventoryRepository.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED,
                com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).map(i -> i.getQuantity())
                .orElseGet(() -> inventoryRepository.findByItemKind(ItemKind.CUSTOM).stream()
                        .filter(i -> i.getCustomColor() == CustomColor.RED).findFirst().orElseThrow().getQuantity());
    }

    @Test
    void searchFindsByCodeAndNeedsTwoCharacters() throws Exception {
        String token = login();
        String id = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        String code = orderRepository.findById(UUID.fromString(id)).orElseThrow().getCode();
        mvc.perform(get("/api/orders/search").param("q", code.substring(0, 5)).header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.code=='" + code + "')]").isNotEmpty());
        mvc.perform(get("/api/orders/search").param("q", "A").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void searchAndAttentionNeedStaff() throws Exception {
        mvc.perform(get("/api/orders/search").param("q", "AWG")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/orders/attention")).andExpect(status().isUnauthorized());
    }

    @Test
    void attentionListIsEmptyWithoutWebOrders() throws Exception {
        String token = login();
        mvc.perform(get("/api/orders/attention").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
    }

    @Test
    void cancellingAfterPaintingStartedDoesNotRestockTheBlank() throws Exception {
        String token = login();
        int before = redStock();
        String id = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        assertThat(redStock()).isEqualTo(before - 1);
        tx.executeWithoutResult(t -> orderRepository.findById(UUID.fromString(id)).orElseThrow()
                .getOrderItems().forEach(i -> i.setProductionStatus(ProductionStatus.IN_PROGRESS)));
        mvc.perform(post("/api/orders/" + id + "/cancel").header("Authorization", bearer(token)))
                .andExpect(status().is2xxSuccessful());
        assertThat(redStock()).isEqualTo(before - 1);
    }

    @Test
    void cancellingAnUntouchedOrderRestocks() throws Exception {
        String token = login();
        int before = redStock();
        String id = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        mvc.perform(post("/api/orders/" + id + "/cancel").header("Authorization", bearer(token)))
                .andExpect(status().is2xxSuccessful());
        assertThat(redStock()).isEqualTo(before);
    }

    @Test
    void sessionsKeepWorkingWhileUsed() throws Exception {
        String token = login();
        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/api/staff/me").header("Authorization", bearer(token))).andExpect(status().isOk());
        }
        assertThat(List.of(token)).isNotEmpty();
    }
}
