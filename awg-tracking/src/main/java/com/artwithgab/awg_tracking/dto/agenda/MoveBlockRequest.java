package com.artwithgab.awg_tracking.dto.agenda;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MoveBlockRequest(@NotNull LocalDate date, double startHour) {
}
