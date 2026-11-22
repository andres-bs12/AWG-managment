package com.artwithgab.awg_tracking.service.mail;

import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.PaymentState;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.service.OrderNotification.Kind;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static com.artwithgab.awg_tracking.service.mail.CustomerMailComposer.Template.*;
import static org.junit.jupiter.api.Assertions.*;

/** One customer e-mail per event (owner decision, 2026-11-22), and every template safe and contactable. */
class CustomerMailRulesTests {

    private static Order order(PaymentState state, DeliveryKind... kinds) {
        Order order = new Order();
        order.setPaymentState(state);
        for (DeliveryKind kind : kinds) {
            OrderItem item = new OrderItem();
            item.setDeliveryKind(kind);
            order.getOrderItems().add(item);
        }
        return order;
    }

    @Test void confirmationGoesOutOnceWhenTheOrderIsComplete() {
        Order order = order(PaymentState.UNPAID, DeliveryKind.MARKET);
        assertEquals(CONFIRMED, CustomerMailComposer.choose(Kind.WEB_PAID, order));
        assertEquals(CONFIRMED, CustomerMailComposer.choose(Kind.SALE_CREATED, order));
        assertEquals(CONFIRMED, CustomerMailComposer.choose(Kind.FORM_COMPLETED, order));
        // Later form edits and Stripe reviews never write to the customer.
        assertNull(CustomerMailComposer.choose(Kind.FORM_SUBMITTED, order));
        assertNull(CustomerMailComposer.choose(Kind.PAYMENT_REVIEW, order));
    }

    @Test void correctingAPaymentBackToUnpaidSendsNothing() {
        assertNull(CustomerMailComposer.choose(Kind.PAYMENT_CHANGED, order(PaymentState.UNPAID, DeliveryKind.MARKET)));
        assertEquals(PAYMENT, CustomerMailComposer.choose(Kind.PAYMENT_CHANGED, order(PaymentState.DEPOSIT, DeliveryKind.MARKET)));
    }

    @Test void readyMailOnlyForPickupsNotForPostParcels() {
        assertNull(CustomerMailComposer.choose(Kind.ALL_FINISHED, order(PaymentState.PAID, DeliveryKind.POST)));
        assertEquals(READY, CustomerMailComposer.choose(Kind.ALL_FINISHED, order(PaymentState.PAID, DeliveryKind.POST, DeliveryKind.MARKET)));
    }

    @Test void handoverShippingCancelAndAddressEachHaveTheirOwnMail() {
        Order order = order(PaymentState.PAID, DeliveryKind.POST);
        assertEquals(THANKS, CustomerMailComposer.choose(Kind.HANDED_OVER, order));
        assertEquals(SHIPPED, CustomerMailComposer.choose(Kind.POST_SHIPPED, order));
        assertEquals(CANCELLED, CustomerMailComposer.choose(Kind.CANCELLED, order));
        assertNull(CustomerMailComposer.choose(Kind.ADDRESS_CHANGED, order), "no address, nothing to confirm");
        order.setDeliveryAddress(new com.artwithgab.awg_tracking.model.Address("Teststraße 2", null, "Wien", "1010"));
        assertEquals(ADDRESS, CustomerMailComposer.choose(Kind.ADDRESS_CHANGED, order));
    }

    private static CustomerMailTemplates.View view(boolean en, String firstName) {
        return new CustomerMailTemplates.View(en, "AWGTEST12", firstName,
                List.of(new CustomerMailTemplates.Line("Personalisierte Kugel", "Rot · Glänzend", new BigDecimal("55.00"))), null,
                new BigDecimal("55.00"), new BigDecimal("27.50"),
                new CustomerMailTemplates.Pickup("So 6. Dez · ab 14:00", "Christkindlmarkt, Stand 12", "https://www.google.com/maps/search/?api=1&query=x"),
                null, "CASH", "22.11.2026", "https://artwithgab.com/track/AWGTEST12", "artwithgab@gmail.com", "https://artwithgab.com");
    }

    @Test void artworkIsHostedOnTheSiteBecauseGmailStripsInlineSvg() {
        var v = view(true, "Andrés");
        var colored = new CustomerMailTemplates.View(true, v.code(), v.firstName(),
                List.of(new CustomerMailTemplates.Line("Custom ornament", "Green · Matte", new BigDecimal("60.00"), "green")), null,
                v.total(), v.paid(), v.pickup(), null, v.paymentMethod(), v.today(), v.trackUrl(), v.contactEmail(), v.siteUrl());
        String html = CustomerMailTemplates.confirmed(colored).html();
        assertFalse(html.contains("<svg"), "no inline SVG");
        for (String asset : List.of("brand.png", "peaks.png", "ornament-green.png", "instagram.png", "email.png")) {
            assertTrue(html.contains("src=\"https://artwithgab.com/mail/" + asset + "\""), asset);
        }
        var local = new CustomerMailTemplates.View(true, v.code(), v.firstName(), colored.lines(), null, v.total(), v.paid(), v.pickup(), null,
                v.paymentMethod(), v.today(), v.trackUrl(), v.contactEmail(), "");
        assertFalse(CustomerMailTemplates.confirmed(local).html().contains("<img"), "no broken images without an absolute site URL");
    }

    @Test void everyTemplateEscapesCustomerTextAndShowsBothContacts() {
        var v = view(false, "<script>alert(1)</script>");
        var post = new CustomerMailTemplates.Post("1.–2. Dezember 2026", "RR123456785AT", "https://www.post.at/s/sendungsdetails?snr=RR123456785AT", "<b>Gasse</b> 1\n1010 Wien");
        var withPost = new CustomerMailTemplates.View(false, v.code(), v.firstName(), v.lines(), new BigDecimal("5.00"), v.total(), v.paid(), null, post,
                v.paymentMethod(), v.today(), v.trackUrl(), v.contactEmail(), v.siteUrl());
        for (var mail : List.of(CustomerMailTemplates.confirmed(v), CustomerMailTemplates.payment(v), CustomerMailTemplates.ready(v),
                CustomerMailTemplates.thanks(v), CustomerMailTemplates.cancelled(v), CustomerMailTemplates.shipped(withPost),
                CustomerMailTemplates.address(withPost), CustomerMailTemplates.waitlist(false, "https://a/c#t", "https://a/u#t", "artwithgab@gmail.com", "https://artwithgab.com"))) {
            assertFalse(mail.html().contains("<script>") || mail.html().contains("<b>Gasse</b>"), mail.subject());
            assertTrue(mail.html().contains("@art_withgab_") && mail.html().contains("artwithgab@gmail.com"), mail.subject());
            assertTrue(mail.text().contains("@art_withgab_") && mail.text().contains("artwithgab@gmail.com"), mail.subject());
            assertFalse(mail.subject().startsWith("ArtWithGab:"), "customer subjects are not the owner's: " + mail.subject());
        }
    }

    @Test void moneyAndLanguageFollowTheCustomer() {
        var de = CustomerMailTemplates.confirmed(view(false, "Luna"));
        assertEquals("Deine Bestellung AWGTEST12 ist bestätigt", de.subject());
        assertTrue(de.text().contains("27,50 €") && de.text().contains("Danke, Luna!") && de.text().contains("bei Abholung"));
        var en = CustomerMailTemplates.confirmed(view(true, ""));
        assertEquals("Your order AWGTEST12 is confirmed", en.subject());
        assertTrue(en.text().contains("€27.50") && en.text().contains("Thank you!"));
        assertFalse(en.text().contains("Bestellung"));
    }

    @Test void readyMailSaysWhereWhenAndWhatIsLeftToPay() {
        var ready = CustomerMailTemplates.ready(view(false, "Luna"));
        assertEquals("Deine Kugel ist fertig · Abholung So 6. Dez · ab 14:00", ready.subject());
        assertTrue(ready.text().contains("Christkindlmarkt, Stand 12") && ready.text().contains("27,50 €") && ready.html().contains("google.com/maps"));
    }

    @Test void shippedMailWorksWithoutATrackingNumber() {
        var post = new CustomerMailTemplates.Post("1.–2. Dezember 2026", null, null, "Gasse 1\n1010 Wien");
        var v = view(false, "Luna");
        var mail = CustomerMailTemplates.shipped(new CustomerMailTemplates.View(false, v.code(), "Luna", v.lines(), null, v.total(), v.total(), null, post,
                null, v.today(), v.trackUrl(), v.contactEmail(), v.siteUrl()));
        assertFalse(mail.text().contains("Sendungsnummer") || mail.text().contains("post.at"));
        assertTrue(mail.text().contains("1.–2. Dezember 2026"));
    }

    @Test void germanDayLabels() {
        assertEquals("So 6. Dez", CustomerMailComposer.day(LocalDate.of(2026, 12, 6), false));
        assertEquals("Sun 6 Dec", CustomerMailComposer.day(LocalDate.of(2026, 12, 6), true));
    }
}
