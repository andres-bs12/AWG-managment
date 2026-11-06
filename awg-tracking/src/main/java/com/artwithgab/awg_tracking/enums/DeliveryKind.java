package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum DeliveryKind {
    /** Pickup at the stall (Fri/Sat/Sun). */
    @JsonProperty("market") MARKET,
    /** Delivery inside Vienna (Wed/Fri). */
    @JsonProperty("vienna") DELIVERY
}
