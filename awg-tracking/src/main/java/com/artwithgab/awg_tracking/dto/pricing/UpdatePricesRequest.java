package com.artwithgab.awg_tracking.dto.pricing;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.artwithgab.awg_tracking.service.PricingService;

import java.math.BigDecimal;
import java.util.List;

/**
 * Ornament prices are at least €0.50 (Stripe's minimum charge); the name surcharge may be zero.
 * backNameMax is the letter limit for the name painted on the back; null keeps the current one.
 * expectedRevision is the revision the screen showed; a different one means someone else saved meanwhile.
 */
public record UpdatePricesRequest(
        @NotNull @DecimalMin("0.50") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2) BigDecimal customPrice,
        @NotNull @DecimalMin("0.50") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2) BigDecimal finishedPrice,
        @NotNull @DecimalMin("0.00") @DecimalMax("999.99") @Digits(integer = 3, fraction = 2) BigDecimal nameExtra,
        @NotNull @DecimalMin("0.00") @DecimalMax("99.99") @Digits(integer = 2, fraction = 2) BigDecimal shippingFee,
        @NotNull @Size(min = 1, max = 5) List<@NotNull @Pattern(regexp = "monday|tuesday|wednesday|thursday|friday") String> postCollectionDays,
        @Min(1) @Max(PricingService.BACK_NAME_MAX_LIMIT) Integer backNameMax,
        @NotNull Long expectedRevision) {
}
