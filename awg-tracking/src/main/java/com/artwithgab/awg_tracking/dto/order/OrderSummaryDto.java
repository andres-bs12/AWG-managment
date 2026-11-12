package com.artwithgab.awg_tracking.dto.order;

import java.math.BigDecimal;

/**
 * One line in staff order search and in the "needs attention" list. {@code checkoutStatus} is null
 * for stall orders; {@code nextHandoffDate} is the earliest pickup/delivery date of the order.
 */
public record OrderSummaryDto(String id, String code, String customerName, String phone, String createdAt,
                              String paymentState, String checkoutStatus, BigDecimal total, int items,
                              String nextHandoffDate, boolean handedOver, String source, String status) {
}
