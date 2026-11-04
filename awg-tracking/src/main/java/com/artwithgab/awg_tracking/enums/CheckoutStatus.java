package com.artwithgab.awg_tracking.enums;

/** Web orders only. PENDING holds painting slots and stock until Stripe confirms or the checkout expires. */
public enum CheckoutStatus {
    PENDING, CONFIRMED
}
