package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Staff password change and order cancellation. */
class StaffOpsApiTests extends ApiTestSupport {
    @Autowired
    InventoryRepository inventory;

    private org.springframework.test.web.servlet.ResultActions changePassword(String token, String current, String next) throws Exception {
        return mvc.perform(withIp(post("/api/staff/password")).header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("currentPassword", current, "newPassword", next))));
    }

    @Test
    void passwordChangeChecksCurrentAndLengthAndSignsOutOtherSessions() throws Exception {
        String token = login();
        String other = login();
        changePassword(token, "wrong-password", "a-new-password-123").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Current password is wrong."));
        changePassword(token, PASSWORD, "short").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Use at least 10 characters."));
        changePassword(token, PASSWORD, "a-new-password-123").andExpect(status().isNoContent());

        mvc.perform(get("/api/staff/me").header("Authorization", bearer(token))).andExpect(status().isOk());
        mvc.perform(get("/api/staff/me").header("Authorization", bearer(other))).andExpect(status().isUnauthorized());
        mvc.perform(withIp(post("/api/staff/login")).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "gaby@artwithgab.com", "password", PASSWORD)))).andExpect(status().isUnauthorized());
    }

    @Test
    void cancelKeepsTheOrderAndRestocksOnce() throws Exception {
        String token = login();
        int before = inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity();
        String id = saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        assertThat(inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity()).isEqualTo(before - 1);

        var original = mvc.perform(get("/api/orders/" + id).header("Authorization", bearer(token))).andReturn().getResponse().getContentAsString();
        String code = com.jayway.jsonpath.JsonPath.read(original, "$.code");
        mvc.perform(post("/api/orders/" + id + "/cancel").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON).content(json(Map.of("reason", "Customer request")))).andExpect(status().isNoContent());
        mvc.perform(post("/api/orders/" + id + "/cancel").header("Authorization", bearer(token))).andExpect(status().isNoContent());
        mvc.perform(get("/api/orders/" + id).header("Authorization", bearer(token))).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED")).andExpect(jsonPath("$.cancellationReason").value("Customer request")).andExpect(jsonPath("$.cancelledAt").isNotEmpty());
        mvc.perform(get("/api/track/" + code)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("cancelled"));
        mvc.perform(patch("/api/orders/" + id + "/handed-over").header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true)))).andExpect(status().isConflict());
        assertThat(inventory.findByItemKindAndCustomColorAndCustomFinish(ItemKind.CUSTOM, CustomColor.RED, com.artwithgab.awg_tracking.enums.CustomFinish.SHINY).orElseThrow().getQuantity()).isEqualTo(before);
        // The painting time is free again: the same slot can be booked.
        saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
    }

    @Test
    void paintingDayCanBeCreatedAndLoweredBelowExistingBookings() throws Exception {
        String token = login();
        saleOk(token, customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        mvc.perform(patch("/api/painting-days/" + TUE).header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("open", true, "maxPaintings", 0))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.booked").value(1))
                .andExpect(jsonPath("$.maxPaintings").value(0));
        mvc.perform(get("/api/painting-days").param("from", TUE).param("to", TUE)
                .header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].booked").value(1))
                .andExpect(jsonPath("$[0].maxPaintings").value(0));
    }

    @Test
    void cancelNeedsStaff() throws Exception {
        mvc.perform(post("/api/orders/00000000-0000-0000-0000-000000000000/cancel")).andExpect(status().isUnauthorized());
    }
}
