package com.artwithgab.awg_tracking.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Size of a personalised (custom) ornament; it sets the price (owner, 2026-11-26).
 * Finished market pieces have no size here. Custom items sold before sizes existed are BIG (V21).
 */
public enum OrnamentSize {
    @JsonProperty("big") BIG(10),
    @JsonProperty("medium") MEDIUM(8);

    private final int centimetres;

    OrnamentSize(int centimetres) {
        this.centimetres = centimetres;
    }

    public int centimetres() {
        return centimetres;
    }
}
