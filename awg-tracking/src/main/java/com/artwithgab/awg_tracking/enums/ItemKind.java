package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum ItemKind {
    /** Painted to order from the customer's photos. */
    @JsonProperty("custom") CUSTOM,
    /** Finished ornament sold from the display (the frontend calls it "finished"). */
    @JsonProperty("finished") GENERIC
}
