package com.artwithgab.awg_tracking.dto.agenda;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.time.LocalDate;
import java.util.UUID;

public record MakeRoomRequest(@NotNull LocalDate date, @Positive @Max(1440) int minutes, UUID marketDayId) {
}
