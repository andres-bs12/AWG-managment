package com.artwithgab.awg_tracking.dto.pricing;

import java.math.BigDecimal;

/** Current prices. revision 0 means the server defaults are in use. */
public record PricesDto(BigDecimal customPrice, BigDecimal finishedPrice, BigDecimal nameExtra, long revision) {
}
