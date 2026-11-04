package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Raw ornament color. JSON values match the frontend (`frontend/src/domain/types.ts`). */
public enum CustomColor {
    @JsonProperty("red") RED,
    @JsonProperty("grey") GREY,
    @JsonProperty("green") GREEN,
    @JsonProperty("white") WHITE
}
