package com.artwithgab.awg_tracking.dto.tracking;



/** Mirrors `TrackWhen`. kind: market | vienna | unknown. */
public record TrackWhenDto(String kind, String date, Double fromHour, String marketName, Double untilHour) {
}
