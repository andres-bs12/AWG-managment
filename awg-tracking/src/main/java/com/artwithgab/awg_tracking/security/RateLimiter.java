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
        if (record(bucket, client) > maxPerMinute) throw new TooManyRequestsException();
    }

    /** Counts one event without enforcing a limit (e.g. a failed login); returns the window count. */
    public int record(String bucket, String client) {
        long now = clock.millis();
        Window w = windows.compute(bucket + "|" + client, (k, old) ->
                old == null || now - old.start() >= 60_000 ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
        if (windows.size() > 50_000) windows.entrySet().removeIf(e -> now - e.getValue().start() >= 60_000);
        return w.count();
    }

    /** Rejects when the current window already holds {@code maxPerMinute} events; does not count. */
    public void requireBelow(String bucket, String client, int maxPerMinute) {
        Window w = windows.get(bucket + "|" + client);
        if (w != null && clock.millis() - w.start() < 60_000 && w.count() >= maxPerMinute) {
            throw new TooManyRequestsException();
        }
    }
}
