package com.artwithgab.awg_tracking.dto.agenda;

/** Effective painting hours and capacity; market pickup hours are unchanged. */
public record PaintingDayDto(String date, boolean open, int maxPaintings, int booked, double openHour, double closeHour) {
}
