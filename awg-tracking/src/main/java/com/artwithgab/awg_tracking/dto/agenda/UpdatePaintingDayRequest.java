package com.artwithgab.awg_tracking.dto.agenda;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UpdatePaintingDayRequest(boolean open, @Min(0) @Max(10) int maxPaintings, Double openHour, Double closeHour) {
}
