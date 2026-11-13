package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum OrderSource {
    /** Sold by staff at the stall (iPad). Paid in person, marked manually. */
    @JsonProperty("stall") STALL,
    /** Bought on the website (Vienna delivery only), paid online with Stripe Checkout. */
    @JsonProperty("web") WEB
}
