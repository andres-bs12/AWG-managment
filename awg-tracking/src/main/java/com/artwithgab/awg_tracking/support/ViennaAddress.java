package com.artwithgab.awg_tracking.support;

/** Deliveries are only inside Vienna: postal codes 1010–1230 (districts 1–23). */
public final class ViennaAddress {
    private static final String POSTAL = "^1(0[1-9]|1[0-9]|2[0-3])0$";

    private ViennaAddress() {
    }

    public static boolean isViennaPostal(String postalCode) {
        return postalCode != null && postalCode.trim().matches(POSTAL);
    }
}
