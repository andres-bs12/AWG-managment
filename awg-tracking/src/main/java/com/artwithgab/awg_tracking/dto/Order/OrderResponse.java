package com.artwithgab.awg_tracking.dto.Order;

import com.artwithgab.awg_tracking.enums.PaymentState;

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
