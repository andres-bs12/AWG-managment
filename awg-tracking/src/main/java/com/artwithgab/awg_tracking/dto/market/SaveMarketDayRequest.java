package com.artwithgab.awg_tracking.dto.market;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record SaveMarketDayRequest(@NotNull LocalDate date, double openHour, double closeHour) {
}
