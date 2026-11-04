package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum PaymentMethod {
    @JsonProperty("cash") CASH,
    @JsonProperty("card") CARD
}
