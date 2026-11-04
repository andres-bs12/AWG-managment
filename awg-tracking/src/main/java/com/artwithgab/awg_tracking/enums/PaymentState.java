package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Set manually by staff after checking the money arrived. DEPOSIT means exactly 50% of the total. */
public enum PaymentState {
    @JsonProperty("unpaid") UNPAID,
    @JsonProperty("deposit") DEPOSIT,
    @JsonProperty("paid") PAID
}
