package com.artwithgab.awg_tracking.dto.order;

import jakarta.validation.constraints.NotNull;

public record HandedOverRequest(@NotNull Boolean handedOver, java.util.List<java.util.UUID> itemIds) {
}
