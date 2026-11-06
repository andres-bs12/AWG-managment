package com.artwithgab.awg_tracking.dto.shop;

/**
 * Redirect the browser to checkoutUrl (Stripe hosted page). formToken is the buyer's own write token
 * (kept by their browser so Track can show and edit the delivery address).
 */
public record CheckoutResponse(String orderCode, String formToken, String checkoutUrl) {
}
