package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.enums.ProductionStatus;
import jakarta.validation.constraints.NotNull;

public record ItemStatusRequest(@NotNull ProductionStatus status) {
}
