package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.security.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.time.Duration;

/** Shared mail budget for new sign-ups and confirmation resends on this application instance. */
@Component
@RequiredArgsConstructor
public class WaitlistQuota {
    private final RateLimiter limiter;

    /** Check before address lookup so an exhausted budget cannot reveal existing subscribers. */
    public void requireAvailable(String clientIp) {
        limiter.requireBelow("waitlist-client", clientIp, 3, Duration.ofHours(1));
        limiter.requireBelow("waitlist-global-hour", "global", 30, Duration.ofHours(1));
        limiter.requireBelow("waitlist-global-day", "global", 200, Duration.ofDays(1));
    }

    public void acquire(String clientIp) {
        limiter.check("waitlist-client", clientIp, 3, Duration.ofHours(1));
        limiter.check("waitlist-global-hour", "global", 30, Duration.ofHours(1));
        limiter.check("waitlist-global-day", "global", 200, Duration.ofDays(1));
    }
}
