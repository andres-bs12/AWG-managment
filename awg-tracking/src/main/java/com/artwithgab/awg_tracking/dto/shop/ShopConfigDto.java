package com.artwithgab.awg_tracking.dto.shop;

import java.math.BigDecimal;
import java.util.List;

/** Public prices, available colors and whether online orders are open. Only custom ornaments are sold online. */
public record ShopConfigDto(boolean enabled, BigDecimal customPrice, BigDecimal nameExtra,
                            BigDecimal deliveryFee, int maxItems, List<ShopColorOptionDto> colors) {
}
