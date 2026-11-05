package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.auth.AuthResponse;
import com.artwithgab.awg_tracking.dto.auth.LoginRequest;
import com.artwithgab.awg_tracking.dto.auth.StaffUserDto;
import com.artwithgab.awg_tracking.model.StaffUser;
import com.artwithgab.awg_tracking.security.AuthService;
import com.artwithgab.awg_tracking.security.BearerTokenFilter;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.ViewMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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
        return authService.login(body.email(), body.password());
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
