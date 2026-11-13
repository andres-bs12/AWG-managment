package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.exception.TooManyRequestsException;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.WaitlistQuota;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

class WaitlistQuotaTests {
    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-12T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }

    @Test void limitsClientIncludingIpv6RotationsToThreePerHour() {
        MutableClock clock = new MutableClock();
        var quota = new WaitlistQuota(new RateLimiter(clock));
        for (int i = 1; i <= 3; i++) quota.acquire("2001:db8:1:2::" + i);
        assertThrows(TooManyRequestsException.class, () -> quota.acquire("2001:db8:1:2::ff"));
        quota.acquire("2001:db8:1:3::1");
        clock.now = clock.now.plusSeconds(3600);
        quota.acquire("2001:db8:1:2::ff");
    }

    @Test void limitsAllClientsToThirtyPerHour() {
        MutableClock clock = new MutableClock();
        var quota = new WaitlistQuota(new RateLimiter(clock));
        for (int i = 1; i <= 30; i++) quota.acquire("10.0.0." + i);
        assertThrows(TooManyRequestsException.class, () -> quota.requireAvailable("10.0.0.31"));
        assertThrows(TooManyRequestsException.class, () -> quota.acquire("10.0.0.31"));
        clock.now = clock.now.plusSeconds(3600);
        quota.acquire("10.0.0.31");
    }

    @Test void dailyBudgetSurvivesHourlyResetAndExpiresAfterDay() {
        MutableClock clock = new MutableClock();
        Instant start = clock.now;
        var quota = new WaitlistQuota(new RateLimiter(clock));
        for (int i = 0; i < 200; i++) {
            clock.now = start.plusSeconds((i / 30) * 3600L);
            quota.acquire("10.0.1." + (i + 1));
        }
        assertThrows(TooManyRequestsException.class, () -> quota.acquire("10.0.2.1"));
        clock.now = start.plusSeconds(86400);
        quota.acquire("10.0.2.1");
    }
}
