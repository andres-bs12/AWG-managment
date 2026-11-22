package com.artwithgab.awg_tracking.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/** Reads "Authorization: Bearer ..." and, when the session is valid, authenticates the staff user. */
public class BearerTokenFilter extends OncePerRequestFilter {
    private final AuthService authService;
    /** Only sessions opened for this client are accepted (see {@code StaffSession#getAudience}). */
    private final String audience;

    public BearerTokenFilter(AuthService authService) {
        this(authService, com.artwithgab.awg_tracking.model.StaffSession.APP);
    }

    public BearerTokenFilter(AuthService authService, String audience) {
        this.authService = authService;
        this.audience = audience;
    }

    public static String token(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) return null;
        return header.substring(7).trim();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = token(request);
        if (token != null) {
            authService.authenticate(token, audience).ifPresent(user -> {
                var auth = new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_STAFF")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(request, response);
    }
}
