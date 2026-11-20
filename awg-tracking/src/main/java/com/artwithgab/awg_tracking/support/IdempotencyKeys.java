package com.artwithgab.awg_tracking.support;

import com.artwithgab.awg_tracking.exception.BadRequestException;

public final class IdempotencyKeys {
    public static final String HEADER = "Idempotency-Key";

    private IdempotencyKeys() {
    }

    public static void validate(String key) {
        if (key == null || !key.matches("[A-Za-z0-9_-]{8,64}")) {
            throw new BadRequestException("Invalid Idempotency-Key.").code("VALIDATION").field(HEADER);
        }
    }
}
