package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.model.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Plain-text source for both MIME alternatives. Tax wording is supplied by configuration only. */
@Component
@RequiredArgsConstructor
public class InvoiceRenderer {
    private final AwgProperties props;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd.MM.uuuu");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    public String render(Order order, long number, Long previous, Instant issuedAt, CalendarIndex calendar, String locale) {
        return render(order, number, previous, issuedAt, calendar, locale, false);
    }

    /** {@code receipt}: payment confirmation for a seller without business data; never claims to be an invoice. */
    public String render(Order order, long number, Long previous, Instant issuedAt, CalendarIndex calendar, String locale, boolean receipt) {
        boolean en = "en".equals(locale);
        BigDecimal total = order.getTotal();
        BigDecimal paid = order.getAmountPaid();
        BigDecimal balance = total.subtract(paid).max(BigDecimal.ZERO);
        var seller = props.invoice();
        StringBuilder b = new StringBuilder();
        if (receipt) {
            String name = nz(order.getCustomer().getName()).trim();
            // Stall sales without a name are stored as "Walk-in": greet them without it.
            if (name.equalsIgnoreCase(Customer.PLACEHOLDER_NAME)) name = "";
            b.append(en ? "Hello" : "Hallo").append(name.isEmpty() ? "" : " " + name).append(",\n\n");
            b.append(balance.signum() == 0
                    ? (en ? "thank you for your order! Here is the confirmation of your payment.\n\n" : "danke für deine Bestellung! Hier ist die Bestätigung deiner Zahlung.\n\n")
                    : (en ? "thank you for your order! Here is the confirmation of your deposit. The rest is paid at handover.\n\n"
                          : "danke für deine Bestellung! Hier ist die Bestätigung deiner Anzahlung. Den Rest zahlst du bei der Übergabe.\n\n"));
            line(b, en ? "Payment confirmation" : "Zahlungsbestätigung", DATE.format(issuedAt.atZone(ZoneId.of(props.zone()))));
            line(b, en ? "Order" : "Bestellung", order.getCode());
        } else {
        b.append(en ? "Hello,\n\n" : "Hallo,\n\n");
        b.append(balance.signum() == 0 ? (en ? "Final invoice" : "Schlussrechnung") : (en ? "Invoice" : "Rechnung"))
                .append(": ").append(number).append('\n');
        line(b, en ? "Invoice date" : "Rechnungsdatum", DATE.format(issuedAt.atZone(ZoneId.of(props.zone()))));
        line(b, en ? "Order" : "Bestellung", order.getCode());
        if (previous != null) line(b, en ? "Replaces invoice" : "Ersetzt Rechnung", previous.toString());
        line(b, en ? "Seller" : "Verkäufer", seller.businessName());
        line(b, en ? "Seller address" : "Firmenadresse", seller.address());
        if (seller.uid() != null && !seller.uid().isBlank()) line(b, "UID", seller.uid());
        line(b, en ? "Tax information" : "Steuerhinweis", seller.taxNote());
        if (seller.iban() != null && !seller.iban().isBlank()) line(b, "IBAN", seller.iban());
        line(b, en ? "Customer" : "Kunde", order.getCustomer().getName());
        }
        var address = order.getDeliveryAddress();
        if (address != null) line(b, en ? "Address" : "Adresse", String.join(", ",
                nz(address.getLine1()), nz(address.getLine2()), nz(address.getPostalCode()), nz(address.getCity())));
        b.append('\n');
        int position = 0;
        for (OrderItem item : order.getOrderItems()) {
            b.append(++position).append(". 1 × ").append(item.getItemKind() == ItemKind.CUSTOM
                    ? (en ? "Custom ornament" : "Personalisierte Christbaumkugel") : (en ? "Finished ornament" : "Fertige Christbaumkugel"));
            if (item.getCustomColor() != null) b.append(" · ").append(color(item.getCustomColor(), en));
            if (item.getCustomFinish() != null) b.append(" · ").append(item.getCustomFinish() == CustomFinish.SHINY
                    ? (en ? "shiny" : "glänzend") : (en ? "matte" : "matt"));
            BigDecimal extra = item.isWithName() ? props.pricing().nameExtra() : BigDecimal.ZERO;
            b.append(": ").append(money(item.getCost().subtract(extra), en)).append('\n');
            if (item.isWithName()) line(b, en ? "   Name surcharge" : "   Namenszuschlag", money(extra, en));
            line(b, en ? "   Item total" : "   Positionssumme", money(item.getCost(), en));
            String date = DATE.format(item.getHandoffDate());
            if (item.getDeliveryKind() == DeliveryKind.DELIVERY) {
                line(b, en ? "   Vienna delivery" : "   Lieferung in Wien", date + " "
                        + TIME.format(props.shop().deliveryWindowStart()) + "–" + TIME.format(props.shop().deliveryWindowEnd()));
            } else {
                var day = calendar.marketDayOn(item.getHandoffDate());
                String market = day.map(d -> d.getMarket().getName()).orElse(en ? "Market" : "Markt");
                // Finished ornaments can be handed over immediately without a separately booked pickup time.
                String time = item.getPickUpTime() != null ? TIME.format(item.getPickUpTime())
                        : order.isHandedOver() && order.getHandedOverAt() != null
                        ? TIME.format(order.getHandedOverAt().atZone(ZoneId.of(props.zone())))
                        : (en ? "time not recorded" : "Uhrzeit nicht erfasst");
                line(b, en ? "   Market pickup" : "   Abholung am Markt", market + ", " + date + " " + time);
            }
        }
        BigDecimal fee = order.getDeliveryFee() == null ? BigDecimal.ZERO : order.getDeliveryFee();
        if (!receipt || fee.signum() > 0) line(b, en ? "Delivery fee" : "Lieferkosten", money(fee, en));
        line(b, en ? "Total" : "Gesamt", money(total, en));
        line(b, en ? "Paid" : "Bezahlt", money(paid, en));
        line(b, en ? "Balance due" : "Offener Betrag", money(balance, en));
        line(b, en ? "Payment state" : "Zahlungsstatus", switch (order.getPaymentState()) {
            case PAID -> en ? "Paid" : "Bezahlt";
            case DEPOSIT -> en ? "Deposit" : "Anzahlung";
            case UNPAID -> en ? "Unpaid" : "Unbezahlt";
        });
        line(b, en ? "Handed over" : "Übergeben", order.isHandedOver() ? (en ? "Yes" : "Ja") : (en ? "No" : "Nein"));
        line(b, en ? "Track your order" : "Bestellung verfolgen", props.shop().publicBaseUrl().replaceAll("/+$", "") + "/track/" + order.getCode());
        if (receipt) b.append(en ? "\nWarm regards,\nGaby · ArtWithGab\n" : "\nLiebe Grüße\nGaby · ArtWithGab\n");
        return b.toString();
    }

    private static String money(BigDecimal value, boolean en) {
        NumberFormat format = NumberFormat.getNumberInstance(en ? Locale.UK : Locale.GERMANY);
        format.setMinimumFractionDigits(2);
        format.setMaximumFractionDigits(2);
        return format.format(value.setScale(2, RoundingMode.HALF_UP)) + " EUR";
    }
    private static String color(CustomColor color, boolean en) {
        return switch (color) {
            case RED -> en ? "red" : "rot";
            case GREEN -> en ? "green" : "grün";
            case BEIGE -> "beige";
            case WHITE -> en ? "white" : "weiß";
            case GREY -> en ? "gray" : "grau";
        };
    }
    private static void line(StringBuilder b, String label, String value) { b.append(label).append(": ").append(nz(value)).append('\n'); }
    private static String nz(String value) { return value == null ? "" : value; }
}
