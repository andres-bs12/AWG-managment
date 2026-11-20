package com.artwithgab.awg_tracking.dto.tracking;


import java.time.LocalDate;

/** Mirrors `TrackWhen`. kind: market | post | vienna | unknown. */
public record TrackWhenDto(String kind, String date, Double fromHour, String marketName, Double untilHour, Double toHour,
                           LocalDate arrivalFrom, LocalDate arrivalTo) {
    public TrackWhenDto(String kind, String date, Double fromHour, String marketName, Double untilHour) {
        this(kind, date, fromHour, marketName, untilHour, null, null, null);
    }
}
