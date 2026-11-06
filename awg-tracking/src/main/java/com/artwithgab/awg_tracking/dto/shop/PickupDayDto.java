package com.artwithgab.awg_tracking.dto.shop;

/**
 * A stall day where a web order can be picked up: there is painting time for every ornament
 * before it. Times are "HH:mm" in Vienna; the customer picks an arrival time between them.
 */
public record PickupDayDto(String date, String weekday, String marketName, Integer stall, String openTime, String closeTime) {
}
