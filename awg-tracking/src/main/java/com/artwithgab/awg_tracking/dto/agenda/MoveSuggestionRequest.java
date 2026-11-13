package com.artwithgab.awg_tracking.dto.agenda;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MoveSuggestionRequest(@NotNull LocalDate date, double durationHours, @NotNull LocalDate handoffDate, Double beforeHour) {
}
