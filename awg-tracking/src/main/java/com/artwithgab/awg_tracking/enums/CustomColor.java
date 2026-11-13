package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Raw ornament color. JSON values match the frontend (`frontend/src/domain/types.ts`).
 * GREY and WHITE are no longer sold but stay for orders and stock rows created before 2026-11-05.
 */
public enum CustomColor {
    @JsonProperty("red") RED(true),
    @JsonProperty("grey") GREY(false),
    @JsonProperty("green") GREEN(true),
    @JsonProperty("white") WHITE(false),
    @JsonProperty("beige") BEIGE(true);

    private final boolean offered;

    CustomColor(boolean offered) {
        this.offered = offered;
    }

    /** Sold now (shop, staff sale and seeded stock). */
    public boolean isOffered() {
        return offered;
    }
}
