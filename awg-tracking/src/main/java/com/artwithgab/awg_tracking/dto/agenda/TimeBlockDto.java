package com.artwithgab.awg_tracking.dto.agenda;

import com.artwithgab.awg_tracking.enums.ProductionStatus;

/** Mirrors `TimeBlock`. Derived from OrderItem.paintStart/paintEnd; `id` is the order item id. */
public record TimeBlockDto(
        String id,
        String marketDayId,
        String orderItemId,
        double startHour,
        double endHour,
        ProductionStatus status
) {
}
