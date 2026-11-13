package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import java.util.Map;
import java.util.List;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BuyMetricsApiTests extends ApiTestSupport {
    @org.springframework.beans.factory.annotation.Autowired com.artwithgab.awg_tracking.service.BuyMetricsService metrics;
    @org.springframework.beans.factory.annotation.Autowired com.artwithgab.awg_tracking.repository.ScheduleLockRepository locks;
    @org.springframework.beans.factory.annotation.Autowired com.artwithgab.awg_tracking.repository.BuyMetricRepository metricsRepository;
    @org.springframework.beans.factory.annotation.Autowired org.springframework.transaction.support.TransactionTemplate transactions;

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentMetricsDoNotWaitForScheduleLockOrLoseIncrements() {
        var input = new com.artwithgab.awg_tracking.service.BuyMetricsService.Input("buy_seq", "review", "", "", "7");
        java.time.LocalDate date = java.time.LocalDate.parse(TUE);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(4)) {
            try {
                transactions.executeWithoutResult(status -> {
                    locks.lockById(com.artwithgab.awg_tracking.model.ScheduleLock.ID).orElseThrow();
                    var work = new java.util.ArrayList<java.util.concurrent.Future<?>>();
                    for (int i = 0; i < 12; i++) work.add(pool.submit(() -> metrics.record(input)));
                    for (var future : work) {
                        try { future.get(5, java.util.concurrent.TimeUnit.SECONDS); }
                        catch (Exception e) { throw new AssertionError("Metrics must complete while the schedule is locked", e); }
                    }
                });
                org.junit.jupiter.api.Assertions.assertEquals(12, metricsRepository
                        .findByDateAndEventAndStepAndFieldAndValue(date, "buy_seq", "review", "", "7").orElseThrow().getCount());
            } finally {
                metricsRepository.findByDateAndEventAndStepAndFieldAndValue(date, "buy_seq", "review", "", "7")
                        .ifPresent(metricsRepository::delete);
            }
        }
    }

    @Test void recordsDetailsAsItsOwnStep() throws Exception {
        for (String step : List.of("details", "delivery")) {
            mvc.perform(withIp(post("/api/metrics/buy")).contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("event", "buy_step", "step", step))))
                    .andExpect(status().isNoContent());
        }
        mvc.perform(get("/api/metrics/buy").param("from", TUE).param("to", TUE).header("Authorization", bearer(login())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.step == 'details')].count").value(1))
                .andExpect(jsonPath("$[?(@.step == 'delivery')].count").value(1));
    }

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
