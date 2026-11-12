package com.artwithgab.awg_tracking;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.core.read.ListAppender;
import com.artwithgab.awg_tracking.controller.AuthController;
import com.artwithgab.awg_tracking.controller.PublicController;
import com.artwithgab.awg_tracking.dto.auth.AuthResponse;
import com.artwithgab.awg_tracking.dto.auth.LoginRequest;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.exception.TooManyRequestsException;
import com.artwithgab.awg_tracking.exception.UnauthorizedException;
import com.artwithgab.awg_tracking.security.AuthService;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.TrackingService;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PublicRateLimitTests {
    @Test
    void exhaustedGlobalTrackBudgetBlocksEveryLookupBeforeDatabaseAccessUntilExpiry() {
        Clock clock = mock(Clock.class);
        AtomicLong now = new AtomicLong(Instant.parse("2026-11-12T12:00:00Z").toEpochMilli());
        when(clock.millis()).thenAnswer(invocation -> now.get());
        RateLimiter limiter = new RateLimiter(clock);
        TrackingService tracking = mock(TrackingService.class);
        when(tracking.getByCode(eq("missing"), any())).thenThrow(new ResourceNotFoundException("Not found"));
        PublicController controller = new PublicController(tracking, null, null, limiter, null, null);
        for (int i = 0; i < 300; i++) {
            String ip = "192.0." + i / 256 + "." + i % 256;
            assertThrows(ResourceNotFoundException.class, () -> controller.track("missing", request(ip)));
        }
        clearInvocations(tracking);
        assertThrows(TooManyRequestsException.class,
                () -> controller.track("missing", request("198.51.100.1")));
        assertThrows(TooManyRequestsException.class,
                () -> controller.track("known", request("198.51.100.1")));
        verifyNoInteractions(tracking);
        now.addAndGet(Duration.ofHours(1).toMillis() - 1);
        assertThrows(TooManyRequestsException.class,
                () -> controller.track("known", request("198.51.100.2")));
        verifyNoInteractions(tracking);
        now.incrementAndGet();
        assertDoesNotThrow(() -> controller.track("known", request("198.51.100.2")));
        verify(tracking).getByCode(eq("known"), any());
        assertThrows(ResourceNotFoundException.class,
                () -> controller.track("missing", request("198.51.100.2")));
    }

    @Test
    void successfulTrackLookupsDoNotConsumeTheGlobalFailureBudget() {
        TrackingService tracking = mock(TrackingService.class);
        PublicController controller = new PublicController(tracking, null, null,
                new RateLimiter(Clock.systemUTC()), null, null);
        for (int i = 0; i < 301; i++) {
            String ip = "192.0." + i / 256 + "." + i % 256;
            assertDoesNotThrow(() -> controller.track("known", request(ip)));
        }
        verify(tracking, times(301)).getByCode(eq("known"), any());
    }

    @Test
    void clientCannotResetTrackBudgetByRotatingIpv6Interfaces() {
        TrackingService tracking = mock(TrackingService.class);
        PublicController controller = new PublicController(tracking, null, null,
                new RateLimiter(Clock.systemUTC()), null, null);
        for (int i = 1; i <= 30; i++) controller.track("known", request("2001:db8:1:2::" + i));
        assertThrows(TooManyRequestsException.class,
                () -> controller.track("known", request("2001:db8:1:2::ffff")));
        verify(tracking, times(30)).getByCode(eq("known"), any());
    }

    @Test
    void accountWideFailureWarningDoesNotBlockLegitimateStaff() {
        AuthService auth = mock(AuthService.class);
        RateLimiter limiter = new RateLimiter(Clock.systemUTC());
        AuthController controller = new AuthController(auth, limiter, null);
        when(auth.login(anyString(), eq("wrong"))).thenThrow(new UnauthorizedException("Wrong e-mail or password."));
        AuthResponse success = new AuthResponse("token", null);
        when(auth.login(anyString(), eq("correct"))).thenReturn(success);
        Logger logger = (Logger) LoggerFactory.getLogger(AuthController.class);
        ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            for (int i = 0; i < 201; i++) {
                int client = i;
                assertThrows(UnauthorizedException.class,
                        () -> controller.login(new LoginRequest("staff@example.com", "wrong"), request("192.0.2." + client)));
            }
            assertSame(success, controller.login(new LoginRequest("staff@example.com", "correct"), request("198.51.100.1")));
            assertEquals(1, appender.list.size());
            assertTrue(appender.list.getFirst().getFormattedMessage().contains("200/minute"));
            assertFalse(appender.list.getFirst().getFormattedMessage().contains("staff@example.com"));
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }

    @Test
    void failedAccountClientPairIsBlockedWithoutBlockingAnotherClient() {
        AuthService auth = mock(AuthService.class);
        RateLimiter limiter = new RateLimiter(Clock.systemUTC());
        AuthController controller = new AuthController(auth, limiter, null);
        for (int i = 0; i < 20; i++) limiter.record("login-failed|staff@example.com", "2001:db8:1:2::1");
        assertThrows(TooManyRequestsException.class,
                () -> controller.login(new LoginRequest("Staff@Example.com", "correct"), request("2001:db8:1:2::2")));
        assertDoesNotThrow(() -> controller.login(new LoginRequest("staff@example.com", "correct"), request("2001:db8:1:3::1")));
        verify(auth, times(1)).login(anyString(), anyString());
    }

    @Test
    void loginAttemptBudgetIsSharedByAnIpv6Prefix() {
        AuthService auth = mock(AuthService.class);
        AuthController controller = new AuthController(auth, new RateLimiter(Clock.systemUTC()), null);
        for (int i = 0; i < 10; i++) {
            controller.login(new LoginRequest("staff@example.com", "correct"), request("2001:db8:5:6::" + i));
        }
        assertThrows(TooManyRequestsException.class,
                () -> controller.login(new LoginRequest("staff@example.com", "correct"), request("2001:db8:5:6::abcd")));
        verify(auth, times(10)).login(anyString(), anyString());
    }

    private static MockHttpServletRequest request(String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(ip);
        return request;
    }
}
