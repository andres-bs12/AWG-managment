package com.artwithgab.awg_tracking.mcp;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Short-lived, single-use OAuth authorization codes (RFC 6749 §4.1.2 with PKCE, RFC 7636).
 * Kept in memory: a code lives two minutes and the backend runs as one instance, so a restart only
 * means the owner clicks "Connect" again. Codes are stored hashed.
 */
@Component
@ConditionalOnProperty(prefix = "awg.mcp", name = "enabled", havingValue = "true")
public class AuthorizationCodeStore {
    static final Duration CODE_TTL = Duration.ofMinutes(2);
    private static final SecureRandom RANDOM = new SecureRandom();

    /** What the token endpoint needs to redeem a code; {@code accessToken} is an opaque staff session token. */
    public record Grant(String clientId, String redirectUri, String codeChallenge, String accessToken, Instant expiresAt) {}

    private final Map<String, Grant> grants = new ConcurrentHashMap<>();
    private final Clock clock;

    public AuthorizationCodeStore(Clock clock) {
        this.clock = clock;
    }

    public String issue(String clientId, String redirectUri, String codeChallenge, String accessToken) {
        purgeExpired();
        String code = randomToken();
        grants.put(hash(code), new Grant(clientId, redirectUri, codeChallenge, accessToken, clock.instant().plus(CODE_TTL)));
        return code;
    }

    /** Removes the code whatever the outcome, so a code can never be tried twice. */
    public Optional<Grant> redeem(String code) {
        if (code == null || code.isBlank() || code.length() > 200) return Optional.empty();
        Grant grant = grants.remove(hash(code));
        if (grant == null || !grant.expiresAt().isAfter(clock.instant())) return Optional.empty();
        return Optional.of(grant);
    }

    private void purgeExpired() {
        Instant now = clock.instant();
        grants.values().removeIf(g -> !g.expiresAt().isAfter(now));
    }

    static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** PKCE S256: BASE64URL(SHA-256(verifier)) compared in constant time. */
    static boolean verifierMatches(String verifier, String challenge) {
        if (verifier == null || challenge == null) return false;
        if (verifier.length() < 43 || verifier.length() > 128 || !verifier.matches("[A-Za-z0-9._~-]+")) return false;
        String computed = Base64.getUrlEncoder().withoutPadding().encodeToString(sha256(verifier));
        return MessageDigest.isEqual(computed.getBytes(StandardCharsets.US_ASCII), challenge.getBytes(StandardCharsets.US_ASCII));
    }

    private static String hash(String value) {
        return HexFormat.of().formatHex(sha256(value));
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
