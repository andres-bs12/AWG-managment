package com.artwithgab.awg_tracking.dto.agenda;

/** One painting date: Gaby's switch and limit, plus how many custom ornaments are booked. */
public record PaintingDayDto(String date, boolean open, int maxPaintings, int booked) {
}
