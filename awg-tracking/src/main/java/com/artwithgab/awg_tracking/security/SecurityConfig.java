package com.artwithgab.awg_tracking.security;

import com.artwithgab.awg_tracking.config.AwgProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Public: login, Track (by code), customer form (by token), photos (unguessable id), web shop
 * and the Stripe webhook (signature-verified).
 * Everything else under /api requires a staff bearer token. Stateless, so CSRF does not apply
 * (no cookies are used for auth).
 */
@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain api(HttpSecurity http, AuthService authService) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(c -> {})
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; img-src 'self'; frame-ancestors 'none'")))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/staff/login").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/track/*").permitAll()
                        .requestMatchers(HttpMethod.PATCH, "/api/track/*/address").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/forms/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/forms/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/photos/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/shop/config").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/shop/delivery-dates", "/api/shop/checkout", "/api/shop/waitlist", "/api/shop/stripe/webhook", "/api/shop/checkout/*/abandon").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/**").hasRole("STAFF")
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> json(res, 401, "Sign in again.", "UNAUTHORIZED"))
                        .accessDeniedHandler((req, res, ex) -> json(res, 403, "Not allowed.", "FORBIDDEN")))
                .addFilterBefore(new BearerTokenFilter(authService), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private static void json(jakarta.servlet.http.HttpServletResponse res, int status, String message, String code) throws java.io.IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.getWriter().write("{\"status\":" + status + ",\"message\":\"" + message + "\",\"code\":\"" + code + "\"}");
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(AwgProperties props) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(props.cors().allowedOrigins() == null ? List.of() : props.cors().allowedOrigins());
        cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Form-Token"));
        cors.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cors);
        return source;
    }

}
