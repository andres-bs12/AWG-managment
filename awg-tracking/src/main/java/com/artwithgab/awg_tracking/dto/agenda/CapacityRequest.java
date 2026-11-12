package com.artwithgab.awg_tracking.dto.agenda;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record CapacityRequest(
        @NotNull LocalDate date,
        @Positive double durationHours,
        Double afterHour,
        Double beforeHour,
        @Valid @Size(max = 50) List<BusyHoursDto> extraBusy
) {
}
