package com.artwithgab.awg_tracking.dto.order;

import java.math.BigDecimal;
import java.util.List;

/**
 * Stable staff sales pagination contract; page is zero-based. {@code received} sums the money taken
 * across every page of the current filters (not only this page), split by how it was paid.
 */
public record SalesPageDto(List<OrderSummaryDto> orders, int page, int size, long totalElements, int totalPages, Received received) {
    /**
     * Money actually received ({@code amountPaid}) by payment method. Cancelled orders and web checkouts
     * not yet confirmed by Stripe are left out. {@code other} holds old payments with no method recorded.
     */
    public record Received(BigDecimal card, BigDecimal cash, BigDecimal other) {}
}
