package com.artwithgab.awg_tracking.dto.market;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Mirrors `MarketDay`. */
public record MarketDayDto(
        String id,
        String marketId,
        String date,
        double openHour,
        double closeHour,
        @JsonProperty("isToday") boolean isToday
) {
}
