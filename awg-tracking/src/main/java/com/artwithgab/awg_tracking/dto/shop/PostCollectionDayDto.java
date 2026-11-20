package com.artwithgab.awg_tracking.dto.shop;

import java.time.LocalDate;

/** Resolved collection date. Override is null when the weekday and holiday rules alone apply. */
public record PostCollectionDayDto(LocalDate date, boolean open, Boolean override) {}
