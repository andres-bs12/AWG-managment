package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.auth.AuthResponse;
import com.artwithgab.awg_tracking.dto.auth.LoginRequest;
import com.artwithgab.awg_tracking.dto.auth.StaffUserDto;
import com.artwithgab.awg_tracking.exception.UnauthorizedException;
import com.artwithgab.awg_tracking.model.StaffUser;
import com.artwithgab.awg_tracking.security.AuthService;
import com.artwithgab.awg_tracking.security.BearerTokenFilter;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.ViewMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final RateLimiter rateLimiter;
    private final ViewMapper mapper;

    @PostMapping("/staff/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        rateLimiter.check("login", request.getRemoteAddr(), 10);
        // Bind failed guesses to both account and client, so remote attackers cannot lock out staff.
        String account = body.email().trim().toLowerCase(java.util.Locale.ROOT);
        String failureBucket = "login-failed|" + account;
        rateLimiter.requireBelow(failureBucket, request.getRemoteAddr(), 20);
        try {
            return authService.login(body.email(), body.password());
        } catch (UnauthorizedException e) {
            rateLimiter.record(failureBucket, request.getRemoteAddr());
            if (rateLimiter.record("login-failed-account", account) == 200) {
                // Avoid account identifiers in logs; this is an alert, never an account lockout.
                log.warn("Staff account failed-login warning threshold reached (200/minute).");
            }
            throw e;
        }
    }

    @GetMapping("/staff/me")
    public StaffUserDto me(@AuthenticationPrincipal StaffUser user) {
        return mapper.staff(user);
    }

    @PostMapping("/staff/password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal StaffUser user,
                                               @Valid @RequestBody com.artwithgab.awg_tracking.dto.auth.ChangePasswordRequest body,
                                               HttpServletRequest request) {
        rateLimiter.check("password", request.getRemoteAddr(), 5);
        authService.changePassword(user, BearerTokenFilter.token(request), body.currentPassword(), body.newPassword());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/staff/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(BearerTokenFilter.token(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
