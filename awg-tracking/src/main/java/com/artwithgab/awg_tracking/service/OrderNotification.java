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
        String items = order.getOrderItems().stream().map(i -> String.format(
                "%s, %s, color: %s, pet: %s, name: %s, note: %s, handoff: %s %s %s, painting: %s, price: %s EUR",
                i.getItemKind(), i.getProductionStatus(), i.getCustomColor(), i.getPetName(), i.getNameInOrnament(),
                i.getNote(), i.getDeliveryKind(), i.getHandoffDate(), i.getPickUpTime(), i.getPaintStart(), i.getCost()))
                .collect(Collectors.joining("\n"));
        var post = kind == Kind.POST_SHIPPED ? order.postItems() : java.util.List.<OrderItem>of();
        LocalDate from = post.stream().map(OrderItem::getArrivalFrom).min(Comparator.naturalOrder()).orElse(null);
        LocalDate to = post.stream().map(OrderItem::getArrivalTo).max(Comparator.naturalOrder()).orElse(null);
        return new OrderNotification(kind, order.getCode(), order.getCustomer().getName(), order.getCustomer().getEmail(),
                order.getTotal(), order.getAmountPaid(), String.valueOf(order.getPaymentState()), address, items,
                order.getId() == null ? null : order.getId().toString(), order.isUnconfirmedWeb(), from, to,
                kind == Kind.POST_SHIPPED ? AustrianPost.trackingUrl(order.getTrackingNumber()) : null);
    }
}
