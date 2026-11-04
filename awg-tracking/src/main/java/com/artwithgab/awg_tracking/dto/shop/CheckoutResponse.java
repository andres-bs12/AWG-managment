package com.artwithgab.awg_tracking.dto.shop;

/** Redirect the browser to checkoutUrl (Stripe hosted page). */
public record CheckoutResponse(String orderCode, String checkoutUrl) {
}
