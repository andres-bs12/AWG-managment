package com.artwithgab.awg_tracking.dto.order;

import jakarta.validation.constraints.NotNull;

public record HandedOverRequest(@NotNull Boolean handedOver) {
}
