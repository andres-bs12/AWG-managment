package com.artwithgab.awg_tracking.enums;

/** Web orders only. PENDING holds painting slots and stock until Stripe confirms or the checkout expires. */
public enum CheckoutStatus {
    PENDING, CONFIRMED,
    /** Stripe reported a payment that does not match the order: staff checks it in Stripe. Never auto-released. */
    REVIEW
}
