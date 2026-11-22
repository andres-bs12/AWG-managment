package com.artwithgab.awg_tracking.dto.order;

import jakarta.validation.constraints.NotNull;

/** {@code collectMethod}: the rest is collected in the same step (one transaction, one customer e-mail). */
public record HandedOverRequest(@NotNull Boolean handedOver, java.util.List<java.util.UUID> itemIds, String trackingNumber,
                                com.artwithgab.awg_tracking.enums.PaymentMethod collectMethod) {
    public HandedOverRequest(Boolean handedOver, java.util.List<java.util.UUID> itemIds, String trackingNumber) {
        this(handedOver, itemIds, trackingNumber, null);
    }
}
