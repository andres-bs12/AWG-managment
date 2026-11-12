package com.artwithgab.awg_tracking.dto.inventory;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** expectedQuantity: the count the screen showed; if a sale changed it meanwhile the update is refused (409). */
public record UpdateInventoryRequest(@Min(0) @Max(10000) int quantity, Integer expectedQuantity) {
}
