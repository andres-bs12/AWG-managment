package com.artwithgab.awg_tracking.security;

import com.artwithgab.awg_tracking.exception.TooManyRequestsException;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory fixed-window limiter for the single application instance. IPv6 clients share a /64. */
@Component
public class RateLimiter {
    private static final Duration MINUTE = Duration.ofMinutes(1);
    private static final long CLEANUP_INTERVAL_MILLIS = 60_000;

    private record Key(String bucket, String client, long durationMillis) {}
    private record Window(long start, int count) {}

    private final Map<Key, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong nextCleanup = new AtomicLong();
    private final Clock clock;

    public RateLimiter(Clock clock) {
        this.clock = clock;
    }

    public void check(String bucket, String client, int maxPerMinute) {
        check(bucket, client, maxPerMinute, MINUTE);
    }

    public void check(String bucket, String client, int maximum, Duration duration) {
        if (!tryAcquire(bucket, client, maximum, duration)) throw new TooManyRequestsException();
    }

    /** Atomically reserves one event, leaving a full window unchanged when the limit is reached. */
    public boolean tryAcquire(String bucket, String client, int maximum, Duration duration) {
        if (maximum <= 0) throw new IllegalArgumentException("The limit must be positive.");
        Key key = key(bucket, client, duration);
        long now = clock.millis();
        AtomicBoolean acquired = new AtomicBoolean();
        windows.compute(key, (k, old) -> {
            if (old == null || expired(old, k, now)) {
                acquired.set(true);
                return new Window(now, 1);
            }
            if (old.count() >= maximum) return old;
            acquired.set(true);
            return new Window(old.start(), old.count() + 1);
        });
        cleanUp(now);
        return acquired.get();
    }

    /** Counts one event without enforcing a limit, such as a failed login. */
    public int record(String bucket, String client) {
        Key key = key(bucket, client, MINUTE);
        long now = clock.millis();
        Window window = windows.compute(key, (k, old) -> old == null || expired(old, k, now)
                ? new Window(now, 1)
                : new Window(old.start(), old.count() == Integer.MAX_VALUE ? Integer.MAX_VALUE : old.count() + 1));
        cleanUp(now);
        return window.count();
    }

    /** Rejects when the minute window already holds the maximum events; does not count. */
    public void requireBelow(String bucket, String client, int maxPerMinute) {
        requireBelow(bucket, client, maxPerMinute, MINUTE);
    }

    /** Checks a shared budget before expensive work without consuming successful requests. */
    public void requireBelow(String bucket, String client, int maximum, Duration duration) {
        if (maximum <= 0) throw new IllegalArgumentException("The limit must be positive.");
        Key key = key(bucket, client, duration);
        Window window = windows.get(key);
        if (window != null && !expired(window, key, clock.millis()) && window.count() >= maximum) {
            throw new TooManyRequestsException();
        }
    }

    /** Normalize numeric addresses only; arbitrary limiter identities must never trigger DNS. */
    public static String clientKey(String client) {
        if (client == null) return "";
        if (!client.contains(":")) return client;
        String address = client.split("%", 2)[0];
        if (!address.matches("[0-9a-fA-F:.]+")) return client;
        try {
            byte[] bytes = InetAddress.getByName(address).getAddress();
            // Java parses IPv4-mapped IPv6 as four bytes; share its IPv4 budget as well.
            if (bytes.length == 4) return InetAddress.getByAddress(bytes).getHostAddress();
            return "ipv6:" + HexFormat.of().formatHex(bytes, 0, 8) + "/64";
        } catch (UnknownHostException ignored) {
            return client;
        }
    }

    private static Key key(String bucket, String client, Duration duration) {
        long millis = duration.toMillis();
        if (millis <= 0) throw new IllegalArgumentException("The window must be positive.");
        return new Key(bucket, clientKey(client), millis);
    }

    private static boolean expired(Window window, Key key, long now) {
        return now - window.start() >= key.durationMillis();
    }

    private void cleanUp(long now) {
        long due = nextCleanup.get();
        // The CAS allows at most one full scan per minute, including under concurrent load.
        if (now >= due && nextCleanup.compareAndSet(due, now + CLEANUP_INTERVAL_MILLIS)) {
            windows.entrySet().removeIf(entry -> expired(entry.getValue(), entry.getKey(), now));
        }
    }
}
