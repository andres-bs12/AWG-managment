package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.enums.PaymentMethod;
import com.artwithgab.awg_tracking.enums.PaymentState;

import java.math.BigDecimal;
import java.util.List;

/**
 * Mirrors `Order`. `trackToken` is kept for the frontend type and equals the public code
 * (the separate track token was dropped, see docs/contracts-and-dtos.md §3).
 * `paymentEntries` is always empty: the app stores the payment state only.
 */
public record OrderDto(
        String id,
        String customerId,
        String code,
        String trackToken,
        String formToken,
        PaymentState paymentState,
        PaymentMethod paymentMethod,
        BigDecimal total,
        BigDecimal amountPaid,
        String createdAt,
        List<String> itemIds,
        boolean handedOver,
        String handedOverAt,
        String status,
        String cancelledAt,
        String cancellationReason,
        boolean paymentReview,
        List<Object> paymentEntries,
        String checkoutStatus,
        com.artwithgab.awg_tracking.enums.OrderSource source
) {
}
