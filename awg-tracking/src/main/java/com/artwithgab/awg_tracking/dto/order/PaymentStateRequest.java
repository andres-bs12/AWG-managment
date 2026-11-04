package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.enums.PaymentMethod;
import com.artwithgab.awg_tracking.enums.PaymentState;
import jakarta.validation.constraints.NotNull;

/** Staff marks the state after checking the money arrived. `method` is optional and informational. */
public record PaymentStateRequest(@NotNull PaymentState state, PaymentMethod method) {
}
