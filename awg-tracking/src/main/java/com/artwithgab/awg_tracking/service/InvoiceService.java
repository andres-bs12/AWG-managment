package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.PaymentState;
import com.artwithgab.awg_tracking.model.Invoice;
import com.artwithgab.awg_tracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

import java.time.*;
import java.util.UUID;
import java.util.function.Function;

/** Durable invoice outbox, written atomically with the payment and delivered after commit. */
@Service
@RequiredArgsConstructor
public class InvoiceService {
    /** A permanently undeliverable address stops being retried after this many failures. */
    public static final int MAX_ATTEMPTS = 10;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(InvoiceService.class);
    private final InvoiceRepository invoices;
    private final InvoiceCounterRepository counters;
    private final OrderRepository orders;
    private final MarketDayRepository days;
    private final InvoiceRenderer renderer;
    private final AwgProperties props;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    @Value("${spring.mail.host:}") private String host;

    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    public void onOrderNotification(OrderNotification event) {
        boolean handover = event.kind() == OrderNotification.Kind.HANDED_OVER;
        if (!handover && event.kind() != OrderNotification.Kind.WEB_PAID && event.kind() != OrderNotification.Kind.SALE_CREATED
                && event.kind() != OrderNotification.Kind.PAYMENT_CHANGED && event.kind() != OrderNotification.Kind.FORM_SUBMITTED) return;
        if (event.orderId() == null) return;
        var order = orders.findById(UUID.fromString(event.orderId())).orElseThrow();
        if (!handover && order.getPaymentState() == PaymentState.UNPAID) return;
        // An invoice with placeholder seller data is not a valid document: issue nothing until it is configured.
        if (!props.invoice().configured()) {
            log.warn("Invoice not issued for order {}: awg.invoice.* seller data is not configured", order.getCode());
            return;
        }
        // One global lock serializes numbering and the duplicate check, including concurrent callbacks.
        var counter = counters.lockCounter().orElseThrow();
        String stateKey = order.getPaymentState() + ":" + order.getTotal().setScale(2) + ":"
                + order.getAmountPaid().setScale(2) + ":" + order.isHandedOver();
        var existing = invoices.findByOrderIdAndStateKey(order.getId(), stateKey);
        Invoice invoice;
        if (existing.isPresent()) {
            invoice = existing.get();
        } else {
            Long previous = invoices.findFirstByOrderIdOrderByNumberDesc(order.getId()).map(Invoice::getNumber).orElse(null);
            long number = counter.getLastNumber() + 1;
            counter.setLastNumber(number);
            invoice = new Invoice();
            invoice.setNumber(number);
            invoice.setOrderId(order.getId());
            invoice.setStateKey(stateKey);
            invoice.setIssuedAt(clock.instant());
            // Orders/customers currently have no locale. Keep German as the explicit default.
            invoice.setSubject("Rechnung " + number + " · " + order.getCode());
            invoice.setBody(renderer.render(order, number, previous, invoice.getIssuedAt(),
                    new CalendarIndex(days.findAllWithMarket(), LocalDateTime.now(clock.withZone(ZoneId.of(props.zone())))), "de"));
            invoice.setRecipient(order.getCustomer().getEmail() == null ? "" : order.getCustomer().getEmail().trim());
            invoice = invoices.save(invoice);
        }
        // A staff payment may precede the customer entering their email through the QR form.
        if (invoice.getSentAt() == null && invoice.getRecipient().isBlank() && order.getCustomer().getEmail() != null)
            invoice.setRecipient(order.getCustomer().getEmail().trim());
        if (invoice.getSentAt() == null && !invoice.getRecipient().isBlank()) events.publishEvent(new InvoiceIssued(invoice.getNumber()));
        // Fill the recipient of earlier snapshots as well when the QR form supplies it later.
        String email = order.getCustomer().getEmail();
        if (email != null && !email.isBlank()) {
            for (Invoice pending : invoices.findByOrderIdOrderByNumberAsc(order.getId())) {
                if (pending.getSentAt() == null && pending.getRecipient().isBlank()) {
                    pending.setRecipient(email.trim());
                    events.publishEvent(new InvoiceIssued(pending.getNumber()));
                }
            }
        }
    }

    /** Serialized delivery prevents duplicate sends from repeated events or overlapping retry runs. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deliver(long number, Function<Invoice, Boolean> send) {
        Invoice invoice = invoices.lockByNumber(number).orElse(null);
        if (invoice == null || invoice.getSentAt() != null || invoice.getRecipient().isBlank() || invoice.getAttempts() >= MAX_ATTEMPTS) return;
        // TRUE sent, FALSE failed attempt, null skipped (mail not configured: not counted).
        Boolean result = send.apply(invoice);
        if (Boolean.TRUE.equals(result)) invoice.setSentAt(clock.instant());
        else if (Boolean.FALSE.equals(result)) invoice.setAttempts(invoice.getAttempts() + 1);
    }

    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void retryPending() {
        if (host == null || host.isBlank() || props.mail().from() == null || props.mail().from().isBlank()) return;
        for (Invoice invoice : invoices.findBySentAtIsNullAndRecipientNotAndAttemptsLessThanOrderByNumberAsc("", MAX_ATTEMPTS, PageRequest.of(0, 100)))
            events.publishEvent(new InvoiceIssued(invoice.getNumber()));
    }
}
