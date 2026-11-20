package com.artwithgab.awg_tracking.dto.shop;

import com.artwithgab.awg_tracking.support.PostShipping;

import java.time.LocalDate;
import java.util.Optional;

public record ShippingWindowDto(boolean available, LocalDate collectionDate, LocalDate arrivalFrom, LocalDate arrivalTo) {
    public static ShippingWindowDto from(Optional<PostShipping.Window> window) {
        return window.map(w -> new ShippingWindowDto(true, w.collectionDate(), w.arrivalFrom(), w.arrivalTo()))
                .orElseGet(() -> new ShippingWindowDto(false, null, null, null));
    }
}
