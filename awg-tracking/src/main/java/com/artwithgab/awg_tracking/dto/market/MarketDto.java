package com.artwithgab.awg_tracking.dto.market;

import com.artwithgab.awg_tracking.enums.MarketKind;

import java.math.BigDecimal;

/** Mirrors `Market`. */
public record MarketDto(
        String id,
        String name,
        MarketKind kind,
        BigDecimal totalCost,
        String startDate,
        String finishDate,
        Integer stall
) {
}
