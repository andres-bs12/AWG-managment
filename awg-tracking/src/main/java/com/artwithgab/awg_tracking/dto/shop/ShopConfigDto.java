package com.artwithgab.awg_tracking.dto.shop;

import java.math.BigDecimal;
import java.util.List;

/**
 * Public prices, available colors/finishes and whether online orders are open. Only custom ornaments
 * are sold online. deliveriesFrom: no delivery day before this date (null = no limit).
 */
public record ShopConfigDto(boolean enabled, BigDecimal customPrice, BigDecimal finishedPrice, BigDecimal nameExtra,
                            BigDecimal deliveryFee, int maxItems, List<ShopColorOptionDto> colors,
                            String seasonEnd, boolean seasonOver, String deliveriesFrom) {
}
