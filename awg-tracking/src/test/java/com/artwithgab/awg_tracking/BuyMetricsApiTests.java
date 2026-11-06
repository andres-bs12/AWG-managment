package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import java.util.Map;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BuyMetricsApiTests extends ApiTestSupport {
    @Test void countsOnlyAllowedAnonymousDimensionsAndRestrictsReports() throws Exception {
        var metric = Map.of("event", "buy_choice", "field", "color", "value", "red");
        for (int i = 0; i < 2; i++) mvc.perform(withIp(post("/api/metrics/buy")).contentType(MediaType.APPLICATION_JSON).content(json(metric))).andExpect(status().isNoContent());
        mvc.perform(withIp(post("/api/metrics/buy")).contentType(MediaType.APPLICATION_JSON).content(json(Map.of("event", "buy_choice", "field", "email", "value", "person@example.com")))).andExpect(status().isBadRequest());
        mvc.perform(withIp(post("/api/metrics/buy")).contentType(MediaType.APPLICATION_JSON).content(json(Map.of("event", "buy_paid")))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/metrics/buy").param("from", TUE).param("to", TUE)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/metrics/buy").param("from", TUE).param("to", TUE).header("Authorization", bearer(login())))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.event == 'buy_choice' && @.field == 'color' && @.value == 'red')].count").value(2));
    }
}
