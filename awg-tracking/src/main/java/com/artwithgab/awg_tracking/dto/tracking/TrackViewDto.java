package com.artwithgab.awg_tracking.dto.tracking;

import com.artwithgab.awg_tracking.dto.order.DeliveryDto;
import com.artwithgab.awg_tracking.enums.PaymentState;

import java.math.BigDecimal;
import java.util.List;

/**
 * Mirrors `TrackView`. Public: only the first name, pet names and handoff info. No phone or email;
 * the address is returned only so the customer sees what they entered.
 * status: preparing | ready | delivered.
 */
public record TrackViewDto(
        BigDecimal total,
        PaymentState paymentState,
        String code,
        String status,
        String customerName,
        List<TrackItemDto> items,
        DeliveryDto delivery,
        TrackWhenDto when
) {
}
