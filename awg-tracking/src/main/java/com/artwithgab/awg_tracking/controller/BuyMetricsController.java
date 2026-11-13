package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.BuyMetricsService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController @RequestMapping("/api/metrics/buy") @RequiredArgsConstructor
public class BuyMetricsController {
    private final BuyMetricsService metrics;
    private final RateLimiter limiter;
    @PostMapping public ResponseEntity<Void> record(@RequestBody BuyMetricsService.Input input, HttpServletRequest request) {
        limiter.check("buy-metrics", request.getRemoteAddr(), 60);
        // Global ceiling: rotating clients must not be able to queue writes on the metrics lock.
        limiter.check("buy-metrics-global", "all", 600);
        metrics.record(input);
        return ResponseEntity.noContent().build();
    }
    @GetMapping public Object list(@RequestParam LocalDate from, @RequestParam LocalDate to) { return metrics.list(from, to); }
}
