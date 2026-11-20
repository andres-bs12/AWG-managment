package com.artwithgab.awg_tracking.dto.tracking;

import com.artwithgab.awg_tracking.dto.order.DeliveryDto;
import com.artwithgab.awg_tracking.enums.PaymentState;

import java.math.BigDecimal;
import java.util.List;

/**
 * Mirrors `TrackView`. Public: only the first name, pet names and handoff info. No phone or email;
 * a legacy Vienna address is returned only to the form token holder.
 * status: preparing | ready | shipped | delivered | cancelled.
 */
public record TrackViewDto(
        BigDecimal total,
        PaymentState paymentState,
        String code,
        String status,
        String customerName,
        List<TrackItemDto> items,
        DeliveryDto delivery,
        TrackWhenDto when,
        String trackingUrl
) {
}
