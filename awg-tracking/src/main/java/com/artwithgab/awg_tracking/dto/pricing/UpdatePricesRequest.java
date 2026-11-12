package com.artwithgab.awg_tracking.dto.pricing;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Ornament prices are at least €0.50 (Stripe's minimum charge); the name surcharge may be zero.
 * expectedRevision is the revision the screen showed; a different one means someone else saved meanwhile.
 */
public record UpdatePricesRequest(
        @NotNull @DecimalMin("0.50") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2) BigDecimal customPrice,
        @NotNull @DecimalMin("0.50") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2) BigDecimal finishedPrice,
        @NotNull @DecimalMin("0.00") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2) BigDecimal nameExtra,
        @NotNull Long expectedRevision) {
}
