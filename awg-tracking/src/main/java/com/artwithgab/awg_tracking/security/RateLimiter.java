package com.artwithgab.awg_tracking.security;

import com.artwithgab.awg_tracking.exception.TooManyRequestsException;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory fixed-window limiter per client and bucket. Enough for one instance; public endpoints
 * keyed by the short order code (9000 values) would otherwise be trivial to enumerate.
 */
@Component
public class RateLimiter {
    private record Window(long start, int count) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    public void check(String bucket, String client, int maxPerMinute) {
        long now = clock.millis();
        String key = bucket + "|" + client;
        Window w = windows.compute(key, (k, old) ->
                old == null || now - old.start() >= 60_000 ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
        if (w.count() > maxPerMinute) throw new TooManyRequestsException();
        if (windows.size() > 50_000) windows.entrySet().removeIf(e -> now - e.getValue().start() >= 60_000);
    }
}
