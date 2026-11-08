package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.repository.InvoiceRepository;
import com.artwithgab.awg_tracking.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InvoiceApiTests extends ApiTestSupport {
    @Autowired InvoiceRepository invoices;
    @Autowired OrderService orders;
    @Autowired com.artwithgab.awg_tracking.service.InvoiceRenderer renderer;
    @Autowired com.artwithgab.awg_tracking.service.CalendarService calendar;
    @Autowired com.artwithgab.awg_tracking.service.InvoiceService invoiceService;
    @Autowired com.artwithgab.awg_tracking.repository.OrderRepository orderRepository;
    @Autowired org.springframework.context.ApplicationEventPublisher events;

    @Test void depositPaidAndHandoverIssueConsecutiveSnapshotsWithoutDuplicates() throws Exception {
        UUID id = UUID.fromString(saleOk(login(), finishedItem()));
        assertThat(invoices.findByOrderIdOrderByNumberAsc(id)).isEmpty();
        orders.updatePaymentState(id, PaymentState.DEPOSIT, PaymentMethod.CASH, new BigDecimal("10.00"));
        orders.updatePaymentState(id, PaymentState.DEPOSIT, PaymentMethod.CASH, new BigDecimal("10.0"));
        var deposit = invoices.findByOrderIdOrderByNumberAsc(id);
        assertThat(deposit).hasSize(1);
        assertThat(deposit.getFirst().getBody()).contains("Gesamt: 39,99 EUR", "Bezahlt: 10,00 EUR", "Offener Betrag: 29,99 EUR");
        orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
        orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
        orders.setHandedOver(id, true);
        orders.setHandedOver(id, true);
        var issued = invoices.findByOrderIdOrderByNumberAsc(id);
        assertThat(issued).hasSize(3);
        assertThat(issued.get(1).getNumber()).isEqualTo(issued.getFirst().getNumber() + 1);
        assertThat(issued.get(2).getNumber()).isEqualTo(issued.get(1).getNumber() + 1);
        assertThat(issued.get(1).getBody()).contains("Offener Betrag: 0,00 EUR", "Ersetzt Rechnung: " + issued.getFirst().getNumber());
        assertThat(issued.get(2).getBody()).contains("Übergeben: Ja", "Offener Betrag: 0,00 EUR");
        assertThat(deposit.getFirst().getBody()).contains("Offener Betrag: 29,99 EUR");
    }

    @Test void handoverDoesNotInventAnUnrecordedPayment() throws Exception {
        UUID id = UUID.fromString(saleOk(login(), finishedItem()));
        orders.updatePaymentState(id, PaymentState.DEPOSIT, PaymentMethod.CASH, new BigDecimal("5.00"));
        orders.setHandedOver(id, true);
        assertThat(invoices.findByOrderIdOrderByNumberAsc(id).getLast().getBody()).contains("Offener Betrag: 34,99 EUR", "Übergeben: Ja");
    }

    @Test void invoiceListsCustomPriceNameAndMarketPickup() throws Exception {
        String staff = login();
        UUID id = UUID.fromString(saleOk(staff, customItem(true, TUE, 10.0, 11.25, "market", dayId(staff, SAT), 14.5)));
        orders.updatePaymentState(id, PaymentState.DEPOSIT, PaymentMethod.CARD, null);
        assertThat(invoices.findByOrderIdOrderByNumberAsc(id).getFirst().getBody()).contains("Personalisierte Christbaumkugel", "rot", "glänzend", "49,99 EUR", "12,99 EUR", "Rathausplatz", "28.11.2026", "14:30", "Test Seller", "/track/", "31,49 EUR");
    }

    @Test void rendererSupportsEnglishWithoutAssumingATaxExemption() throws Exception {
        UUID id = UUID.fromString(saleOk(login(), finishedItem()));
        var order = orderRepository.findById(id).orElseThrow();
        String text = renderer.render(order, 123L, null, order.getCreatedAt(), calendar.snapshot(), "en");
        assertThat(text).contains("Invoice: 123", "Finished ornament", "Total: 39.99 EUR", "Paid: 0.00 EUR",
                "Balance due: 39.99 EUR", "Payment state: Unpaid", "Test Seller", "ATU00000000");
    }

    @Test void qrEmailCompletesAllPendingSnapshotsWithoutIssuingAnotherInvoice() throws Exception {
        UUID id = UUID.fromString(saleOk(login(), finishedItem()));
        orders.updatePaymentState(id, PaymentState.DEPOSIT, PaymentMethod.CASH, new BigDecimal("10.00"));
        orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
        var order = orderRepository.findById(id).orElseThrow();
        order.getCustomer().setEmail("later@example.com");
        events.publishEvent(com.artwithgab.awg_tracking.service.OrderNotification.from(order,
                com.artwithgab.awg_tracking.service.OrderNotification.Kind.FORM_SUBMITTED));
        assertThat(invoices.findByOrderIdOrderByNumberAsc(id)).hasSize(2)
                .allSatisfy(i -> assertThat(i.getRecipient()).isEqualTo("later@example.com"));
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void failedDeliveryRetriesTheSameDocumentAndSuccessfulDeliveryIsNotRepeated() throws Exception {
        UUID id = UUID.fromString(saleOk(login(), finishedItem()));
        try {
            orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
            var invoice = invoices.findByOrderIdOrderByNumberAsc(id).getFirst();
            // Supply a recipient without SMTP so delivery success/failure can be exercised deterministically.
            invoice.setRecipient("retry@example.com");
            invoices.saveAndFlush(invoice);
            var attempts = new java.util.concurrent.atomic.AtomicInteger();
            invoiceService.deliver(invoice.getNumber(), i -> { attempts.incrementAndGet(); return false; });
            assertThat(invoices.findById(invoice.getNumber()).orElseThrow().getSentAt()).isNull();
            invoiceService.deliver(invoice.getNumber(), i -> { attempts.incrementAndGet(); return true; });
            invoiceService.deliver(invoice.getNumber(), i -> { attempts.incrementAndGet(); return true; });
            assertThat(attempts.get()).isEqualTo(2);
            assertThat(invoices.findById(invoice.getNumber()).orElseThrow().getSentAt()).isNotNull();
            assertThat(invoices.findByOrderIdOrderByNumberAsc(id)).hasSize(1);
        } finally { orders.cancelOrder(id); }
    }

    @Test void deliveryWindowIsIncludedInTrackFormConfigAndInvoice() throws Exception {
        String staff = login();
        UUID id = UUID.fromString(saleOk(staff, customItem(false, TUE, 10.0, 11.0, "vienna", dayId(staff, WED), null)));
        var order = orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
        mvc.perform(withIp(get("/api/track/" + order.code()))).andExpect(status().isOk())
                .andExpect(jsonPath("$.when.kind").value("vienna"))
                .andExpect(jsonPath("$.when.fromHour").value(18.0)).andExpect(jsonPath("$.when.toHour").value(20.0));
        mvc.perform(withIp(get("/api/forms/" + order.formToken()))).andExpect(status().isOk())
                .andExpect(jsonPath("$.handoffs[0].fromHour").value(18.0)).andExpect(jsonPath("$.handoffs[0].toHour").value(20.0));
        mvc.perform(get("/api/shop/config")).andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryWindowStart").value("18:00"))
                .andExpect(jsonPath("$.deliveryWindowEnd").value("20:00"));
        assertThat(invoices.findByOrderIdOrderByNumberAsc(id).getFirst().getBody()).contains("25.11.2026", "18:00–20:00");
    }

    @Test void placeholderSellerDataIsNotConfigured() {
        assertThat(new com.artwithgab.awg_tracking.config.AwgProperties.Invoice("[Firmenname]", "Addr", null, "Note", null).configured()).isFalse();
        assertThat(new com.artwithgab.awg_tracking.config.AwgProperties.Invoice("Seller", "Addr", "[UID falls vorhanden]", "Note", null).configured()).isFalse();
        assertThat(new com.artwithgab.awg_tracking.config.AwgProperties.Invoice("Seller", "", null, "Note", null).configured()).isFalse();
        assertThat(new com.artwithgab.awg_tracking.config.AwgProperties.Invoice("Seller", "Addr", null, "Note", null).configured()).isTrue();
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void failedDeliveryStopsAfterMaxAttempts() throws Exception {
        UUID id = UUID.fromString(saleOk(login(), finishedItem()));
        try {
        orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
        var invoice = invoices.findByOrderIdOrderByNumberAsc(id).getFirst();
        invoice.setRecipient("retry@example.com");
        invoices.saveAndFlush(invoice);
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        for (int i = 0; i < com.artwithgab.awg_tracking.service.InvoiceService.MAX_ATTEMPTS + 3; i++)
            invoiceService.deliver(invoice.getNumber(), x -> { calls.incrementAndGet(); return false; });
        assertThat(calls.get()).isEqualTo(com.artwithgab.awg_tracking.service.InvoiceService.MAX_ATTEMPTS);
        invoiceService.deliver(invoice.getNumber(), x -> { calls.incrementAndGet(); return null; });
        assertThat(invoices.findById(invoice.getNumber()).orElseThrow().getSentAt()).isNull();
        } finally { orders.cancelOrder(id); }
    }
}
