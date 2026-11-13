package com.artwithgab.awg_tracking.dto.agenda;

import com.artwithgab.awg_tracking.dto.common.HourSpanDto;

/** Mirrors `CapacityResult`. */
public record CapacityResultDto(boolean ok, HourSpanDto slot, double remainingHours, String message) {
}
