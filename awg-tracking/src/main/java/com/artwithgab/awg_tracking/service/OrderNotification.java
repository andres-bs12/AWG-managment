package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.support.AustrianPost;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/** A complete snapshot taken while the order is still attached to its transaction. */
public record OrderNotification(Kind kind, String code, String customerName, String customerEmail,
                                BigDecimal total, BigDecimal amountPaid, String paymentState,
                                String address, String items, String orderId, boolean unconfirmedWeb, LocalDate arrivalFrom,
                                LocalDate arrivalTo, String trackingUrl) {
    public enum Kind {
        WEB_PAID("New web order paid - please review", "Deine Online-Bestellung wurde bezahlt", "Your online order has been paid"),
        SALE_CREATED("Stall sale created", "Deine Bestellung wurde aufgenommen", "Your order has been placed"),
        PAYMENT_CHANGED("Payment updated", "Deine Zahlung wurde aktualisiert", "Your payment has been updated"),
        ALL_FINISHED("All ornaments finished", "Deine Ornamente sind fertig", "Your ornaments are ready"),
        HANDED_OVER("Order handed over", "Deine Bestellung wurde übergeben", "Your order has been handed over"),
        POST_SHIPPED("Shipment handed to Post", "Deine Bestellung ist unterwegs", ""),
        CANCELLED("Order cancelled", "Deine Bestellung wurde storniert", "Your order has been cancelled"),
        ADDRESS_CHANGED("Delivery address changed", "Deine Lieferadresse wurde geändert", "Your delivery address has changed"),
        /** First time the customer sends the QR form: the customer gets their order confirmation. */
        FORM_COMPLETED("Customer form completed", "", ""),
        /** Later edits of an already completed form: owner notice only. */
        FORM_SUBMITTED("Customer form edited", "", ""),
        PAYMENT_REVIEW("Stripe payment needs review (amount/currency mismatch)", "", "");
        final String owner, german, english;
        Kind(String owner, String german, String english) { this.owner = owner; this.german = german; this.english = english; }
    }
    public static OrderNotification from(Order order, Kind kind) {
        var a = order.getDeliveryAddress();
        String address = a == null ? "Not provided" : Stream.of(a.getLine1(), a.getLine2(), a.getPostalCode(), a.getCity())
                .filter(s -> s != null && !s.isBlank()).collect(Collectors.joining(", "));
        String items = order.getOrderItems().stream().map(OrderNotification::itemLine).collect(Collectors.joining("\n"));
        var post = kind == Kind.POST_SHIPPED ? order.postItems() : java.util.List.<OrderItem>of();
        LocalDate from = post.stream().map(OrderItem::getArrivalFrom).min(Comparator.naturalOrder()).orElse(null);
        LocalDate to = post.stream().map(OrderItem::getArrivalTo).max(Comparator.naturalOrder()).orElse(null);
        return new OrderNotification(kind, order.getCode(), order.getCustomer().getName(), order.getCustomer().getEmail(),
                order.getTotal(), order.getAmountPaid(), String.valueOf(order.getPaymentState()), address, items,
                order.getId() == null ? null : order.getId().toString(), order.isUnconfirmedWeb(), from, to,
                kind == Kind.POST_SHIPPED ? AustrianPost.trackingUrl(order.getTrackingNumber()) : null);
    }

    /** One readable line per item for the owner, e.g. "Custom · Green · Luna · name LUNA · Post Fri 27 Nov · paint Thu 26 Nov 10:00 · Painted · 60.00 EUR". */
    static String itemLine(OrderItem i) {
        java.util.List<String> parts = new java.util.ArrayList<>();
        parts.add(i.getItemKind() == com.artwithgab.awg_tracking.enums.ItemKind.CUSTOM ? "Custom" : "Finished" + (i.getMarketOrnamentId() == null ? "" : " " + i.getMarketOrnamentId()));
        if (i.getCustomColor() != null) parts.add(cap(i.getCustomColor().name()) + (i.getCustomFinish() == null ? "" : " " + i.getCustomFinish().name().toLowerCase(java.util.Locale.ROOT)));
        if (i.getPetName() != null && !i.getPetName().isBlank()) parts.add(i.getPetName());
        if (i.getNameInOrnament() != null && !i.getNameInOrnament().isBlank()) parts.add("name " + i.getNameInOrnament());
        if (i.getDeliveryKind() != null) {
            String when = i.getHandoffDate() == null ? "" : " " + DAY.format(i.getHandoffDate());
            String time = i.getPickUpTime() == null ? "" : " " + i.getPickUpTime();
            parts.add(cap(i.getDeliveryKind().name()) + when + time);
        }
        if (i.getPaintStart() != null) parts.add("paint " + PAINT.format(i.getPaintStart()));
        if (i.getProductionStatus() != null) parts.add(cap(i.getProductionStatus().name().replace('_', ' ')));
        if (i.getNote() != null && !i.getNote().isBlank()) parts.add("note: " + i.getNote());
        parts.add((i.getCost() == null ? "0.00" : i.getCost().setScale(2, java.math.RoundingMode.HALF_UP).toPlainString()) + " EUR");
        return String.join(" · ", parts);
    }

    private static final java.time.format.DateTimeFormatter DAY = java.time.format.DateTimeFormatter.ofPattern("EEE d MMM", java.util.Locale.UK);
    private static final java.time.format.DateTimeFormatter PAINT = java.time.format.DateTimeFormatter.ofPattern("EEE d MMM HH:mm", java.util.Locale.UK);

    private static String cap(String value) {
        String lower = value.toLowerCase(java.util.Locale.ROOT);
        return lower.isEmpty() ? lower : Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
