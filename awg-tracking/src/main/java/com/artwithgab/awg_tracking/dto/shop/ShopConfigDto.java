package com.artwithgab.awg_tracking.dto.shop;

import java.math.BigDecimal;

/** Public prices and whether online orders are open. */
public record ShopConfigDto(boolean enabled, BigDecimal customPrice, BigDecimal finishedPrice, BigDecimal nameExtra,
                            BigDecimal deliveryFee, int maxItems) {
}
