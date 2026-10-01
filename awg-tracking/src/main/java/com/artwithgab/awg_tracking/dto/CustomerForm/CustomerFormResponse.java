package com.artwithgab.awg_tracking.dto.CustomerForm;

import com.artwithgab.awg_tracking.dto.Order.OrderItemResponse;
import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.DeliveryKind;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public record CustomerFormResponse(
        double total,
        DeliveryKind deliveryKind,
        LocalTime pickUpTime,
        List<OrderItemResponse> orderItemResponses,
        String code
) {
}
