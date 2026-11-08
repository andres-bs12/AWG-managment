package com.artwithgab.awg_tracking.dto.tracking;



/** Mirrors `TrackWhen`. kind: market | vienna | unknown. */
public record TrackWhenDto(String kind, String date, Double fromHour, String marketName, Double untilHour, Double toHour) {
    public TrackWhenDto(String kind, String date, Double fromHour, String marketName, Double untilHour) {
        this(kind, date, fromHour, marketName, untilHour, null);
    }
}
