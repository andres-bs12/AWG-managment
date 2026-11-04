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

    /** AWG + 4 digits (1000–9999). The unique constraint on orders.code is the final guard. */
    public String generateCode() {
        for (int attempt = 0; attempt < 200; attempt++) {
            String code = "AWG" + (1000 + RANDOM.nextInt(9000));
            if (!orderRepository.existsByCode(code)) return code;
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
