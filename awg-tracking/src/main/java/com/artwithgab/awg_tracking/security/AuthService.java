package com.artwithgab.awg_tracking.security;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.dto.auth.AuthResponse;
import com.artwithgab.awg_tracking.exception.UnauthorizedException;
import com.artwithgab.awg_tracking.model.StaffSession;
import com.artwithgab.awg_tracking.model.StaffUser;
import com.artwithgab.awg_tracking.repository.StaffSessionRepository;
import com.artwithgab.awg_tracking.repository.StaffUserRepository;
import com.artwithgab.awg_tracking.service.ViewMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;

/** Staff login with opaque bearer tokens (random 256-bit, stored hashed, expiring). */
@Service
@RequiredArgsConstructor
public class AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    /** Hash compared on unknown e-mails so both paths cost the same (no user enumeration by timing). */
    private volatile String dummyHash;

    private final StaffUserRepository staffUserRepository;
    private final StaffSessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AwgProperties props;
    private final ViewMapper mapper;
    private final Clock clock;

    @Transactional
    public AuthResponse login(String email, String password) {
        Optional<StaffUser> user = staffUserRepository.findByEmail(email.trim().toLowerCase(Locale.ROOT));
        boolean ok = passwordEncoder.matches(password, user.map(StaffUser::getPasswordHash).orElseGet(this::dummyHash));
        if (user.isEmpty() || !ok) throw new UnauthorizedException("Wrong e-mail or password.");

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        StaffSession session = new StaffSession();
        session.setTokenHash(hash(token));
        session.setStaffUser(user.get());
        Instant now = clock.instant();
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(props.session().ttl()));
        sessionRepository.save(session);
        return new AuthResponse(token, mapper.staff(user.get()));
    }

    /**
     * Changes the signed-in user's password and signs out their other sessions. A wrong current
     * password is a 400, not a 401, so the client does not treat it as an expired session.
     */
    @Transactional
    public void changePassword(StaffUser principal, String currentToken, String currentPassword, String newPassword) {
        StaffUser user = staffUserRepository.findById(principal.getId())
                .orElseThrow(() -> new UnauthorizedException("Sign in again."));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new com.artwithgab.awg_tracking.exception.BadRequestException("Current password is wrong.");
        }
        if (newPassword.length() < 10) {
            throw new com.artwithgab.awg_tracking.exception.BadRequestException("Use at least 10 characters.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        sessionRepository.deleteOtherSessions(user.getId(), currentToken == null ? "" : hash(currentToken));
    }

    @Transactional(readOnly = true)
    public Optional<StaffUser> authenticate(String token) {
        if (token == null || token.isBlank() || token.length() > 100) return Optional.empty();
        return sessionRepository.findByTokenHash(hash(token))
                .filter(s -> s.getExpiresAt().isAfter(clock.instant()))
                .map(StaffSession::getStaffUser);
    }

    @Transactional
    public void logout(String token) {
        if (token != null) sessionRepository.deleteByTokenHash(hash(token));
    }

    @Scheduled(fixedDelayString = "PT1H")
    @Transactional
    public void purgeExpired() {
        sessionRepository.deleteExpired(clock.instant());
    }

    private String dummyHash() {
        if (dummyHash == null) dummyHash = passwordEncoder.encode("not-a-real-password");
        return dummyHash;
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
