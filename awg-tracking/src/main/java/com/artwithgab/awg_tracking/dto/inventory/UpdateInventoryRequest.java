package com.artwithgab.awg_tracking.dto.inventory;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UpdateInventoryRequest(@Min(0) @Max(10000) int quantity) {
}
