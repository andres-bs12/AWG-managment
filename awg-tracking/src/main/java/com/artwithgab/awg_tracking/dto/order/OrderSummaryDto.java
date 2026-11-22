package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;

import java.math.BigDecimal;
import java.util.List;

/**
 * One line in staff order search and in the "needs attention" list. {@code checkoutStatus} is null
 * for stall orders; {@code nextHandoffDate} is the earliest pickup/delivery date of the order.
 */
public record OrderSummaryDto(String id, String code, String customerName, String phone, String createdAt,
                              String paymentState, String checkoutStatus, BigDecimal total, int items,
                              String nextHandoffDate, boolean handedOver, String source, String status,
                              /** What was recorded as received, so lists can show the balance due. */
                              BigDecimal amountPaid, String soldAtMarketName, List<SaleItem> saleItems,
                              /** A paid web order staff has not marked as reviewed yet. */
                              boolean needsReview) {
    public record SaleItem(String id, ItemKind kind, CustomColor color, String photoUrl, String marketOrnamentId) {}
}
