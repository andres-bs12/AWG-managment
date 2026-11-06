package com.artwithgab.awg_tracking.dto.common;



/** `{ date, startHour, endHour }` used by capacity and move suggestions. Hours are decimal (10.5 = 10:30). */
public record HourSpanDto(String date, double startHour, double endHour) {
}
