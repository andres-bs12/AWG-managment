package com.artwithgab.awg_tracking.dto.form;

import com.artwithgab.awg_tracking.dto.common.CustomerDto;
import com.artwithgab.awg_tracking.dto.order.OrderItemDto;
import com.artwithgab.awg_tracking.dto.tracking.TrackWhenDto;
import com.artwithgab.awg_tracking.enums.PaymentState;

import java.math.BigDecimal;
import java.util.List;

/** Mirrors `CustomerFormView`. */
public record CustomerFormViewDto(
        List<TrackWhenDto> handoffs,
        BigDecimal total,
        PaymentState paymentState,
        List<OrderItemDto> items,
        String token,
        String orderCode,
        boolean withName,
        boolean alreadySubmitted,
        CustomerDto customer,
        OrderItemDto item,
        boolean needsAddress,
        com.artwithgab.awg_tracking.dto.common.AddressDto address,
        boolean editable
) {
}
