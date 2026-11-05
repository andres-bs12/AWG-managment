package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;

@Service
@RequiredArgsConstructor
public class OrderCodeGenerator {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final OrderRepository orderRepository;

    /** No 0/O/1/I so codes read well aloud and on paper. */
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    /**
     * AWG + 6 characters (32^6 ≈ 1 billion, so codes cannot be guessed). Old AWG + 4 digit codes stay
     * valid. The unique constraint on orders.code is the final guard.
     */
    public String generateCode() {
        for (int attempt = 0; attempt < 200; attempt++) {
            StringBuilder code = new StringBuilder("AWG");
            for (int i = 0; i < 6; i++) code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            if (!orderRepository.existsByCode(code.toString())) return code.toString();
        }
        throw new IllegalStateException("Order code space exhausted");
    }

    /** 256-bit URL-safe secret for the customer form link. */
    public String generateFormToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
