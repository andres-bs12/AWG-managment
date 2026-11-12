package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum MarketKind {
    /** A Christmas market stall. */
    @JsonProperty("market") MARKET,
    /** Painting at home ("Casa"). */
    @JsonProperty("home") HOME
}
