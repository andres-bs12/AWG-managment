package com.artwithgab.awg_tracking.dto.Order;

import com.artwithgab.awg_tracking.enums.PaymentState;
import com.artwithgab.awg_tracking.model.Customer;
import com.artwithgab.awg_tracking.model.OrderItem;
import jakarta.annotation.Nullable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;
import java.util.UUID;

public record OrderResponse(
        UUID id,
        String formToken,
        String code,
        double total,
        List<OrderItemResponse> orderItemList,
        Boolean handedOver,
        String name,
        String phone,
        String email,
        PaymentState paymentState
) {
}
