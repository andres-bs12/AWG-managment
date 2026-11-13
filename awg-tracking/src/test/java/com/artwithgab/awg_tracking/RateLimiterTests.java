package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.exception.TooManyRequestsException;
import com.artwithgab.awg_tracking.security.RateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class RateLimiterTests {
    @Test
    void ipv6InterfaceRotationSharesOnePrefixBudget() {
        RateLimiter limiter = new RateLimiter(Clock.systemUTC());
        limiter.check("public", "2001:db8:1234:5678::1", 1);
        assertThrows(TooManyRequestsException.class,
                () -> limiter.check("public", "2001:0db8:1234:5678:abcd:ef01:2345:6789", 1));
        assertDoesNotThrow(() -> limiter.check("public", "2001:db8:1234:5679::1", 1));
    }

    @Test
    void mappedIpv4AndPlainIpv4ShareOneBudget() {
        RateLimiter limiter = new RateLimiter(Clock.systemUTC());
        limiter.check("public", "192.0.2.15", 1);
        assertThrows(TooManyRequestsException.class,
                () -> limiter.check("public", "::ffff:192.0.2.15", 1));
        assertDoesNotThrow(() -> limiter.check("public", "192.0.2.16", 1));
        assertEquals("mail:staff@example.com", RateLimiter.clientKey("mail:staff@example.com"));
    }

    @Test
    void durationWindowsExpireAndRejectedAttemptsDoNotExtendThem() {
        MutableClock clock = new MutableClock();
        RateLimiter limiter = new RateLimiter(clock);
        assertTrue(limiter.tryAcquire("waitlist", "global", 1, Duration.ofHours(1)));
        clock.advance(Duration.ofMinutes(59));
        assertFalse(limiter.tryAcquire("waitlist", "global", 1, Duration.ofHours(1)));
        clock.advance(Duration.ofMinutes(1));
        assertTrue(limiter.tryAcquire("waitlist", "global", 1, Duration.ofHours(1)));
        assertThrows(TooManyRequestsException.class,
                () -> limiter.check("waitlist", "global", 1, Duration.ofHours(1)));
    }

    @Test
    void concurrentAcquisitionsCannotExceedTheBudget() throws Exception {
        RateLimiter limiter = new RateLimiter(Clock.systemUTC());
        AtomicInteger allowed = new AtomicInteger();
        try (var pool = Executors.newFixedThreadPool(8)) {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 100; i++) {
                futures.add(pool.submit(() -> {
                    if (limiter.tryAcquire("mail", "global", 30, Duration.ofHours(1))) allowed.incrementAndGet();
                }));
            }
            for (Future<?> future : futures) future.get();
        }
        assertEquals(30, allowed.get());
    }

    @Test
    void cleanupScansAtMostOncePerMinuteAndRetainsLongerWindows() {
        MutableClock clock = new MutableClock();
        RateLimiter limiter = new RateLimiter(clock);
        limiter.check("short", "one", 1, Duration.ofSeconds(1));
        limiter.check("long", "one", 1, Duration.ofHours(1));
        clock.advance(Duration.ofSeconds(2));
        for (int i = 0; i < 50_001; i++) limiter.record("clients", "client-" + i);
        Map<?, ?> windows = (Map<?, ?>) ReflectionTestUtils.getField(limiter, "windows");
        assertNotNull(windows);
        assertEquals(50_003, windows.size(), "Requests within the cleanup period must not scan expired keys.");
        clock.advance(Duration.ofSeconds(58));
        limiter.record("clients", "new-client");
        assertEquals(50_003, windows.size(), "Only the expired short window is removed after one minute.");
        assertFalse(limiter.tryAcquire("long", "one", 1, Duration.ofHours(1)));
        clock.advance(Duration.ofSeconds(2));
        limiter.record("clients", "another-client");
        assertEquals(50_004, windows.size(), "Expired client keys wait for the next periodic cleanup.");
        clock.advance(Duration.ofSeconds(58));
        limiter.record("clients", "after-cleanup");
        assertEquals(3, windows.size());
    }

    @Test
    void failedEventThresholdUsesTheSameNormalizedClientAndExpires() {
        MutableClock clock = new MutableClock();
        RateLimiter limiter = new RateLimiter(clock);
        assertEquals(1, limiter.record("failed|account", "2001:db8::1"));
        assertThrows(TooManyRequestsException.class,
                () -> limiter.requireBelow("failed|account", "2001:db8::2", 1));
        assertDoesNotThrow(() -> limiter.requireBelow("failed|other", "2001:db8::2", 1));
        clock.advance(Duration.ofMinutes(1));
        assertDoesNotThrow(() -> limiter.requireBelow("failed|account", "2001:db8::2", 1));
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-12T12:00:00Z");
        void advance(Duration duration) { now = now.plus(duration); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
