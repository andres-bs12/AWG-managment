package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {
    private final ObjectProvider<JavaMailSender> sender;
    private final AwgProperties properties;
    private final InvoiceService invoices;
    private final com.artwithgab.awg_tracking.security.RateLimiter limiter;
    @Value("${spring.mail.host:}") private String host;

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderNotification(OrderNotification event) {
        boolean publicEdit = event.kind() == OrderNotification.Kind.ADDRESS_CHANGED || event.kind() == OrderNotification.Kind.FORM_SUBMITTED;
        // Both edit kinds share one budget; changing endpoint must not double the mail allowance.
        if (publicEdit && !limiter.tryAcquire("order-edit-mail", event.orderId() == null ? event.code() : event.orderId(),
                1, java.time.Duration.ofMinutes(15))) return;
        String link = properties.shop().publicBaseUrl().replaceAll("/+$", "") + "/track/" + URLEncoder.encode(event.code(), StandardCharsets.UTF_8);
        String subject = "ArtWithGab: " + event.kind().owner + " - " + event.code();
        String ownerBody = "Order: " + event.code() + "\nCustomer: " + event.customerName() + "\nEmail: " + event.customerEmail()
                + "\nTotal: " + event.total() + " EUR\nAmount paid: " + event.amountPaid() + " EUR\nPayment: " + event.paymentState()
                + "\nAddress: " + event.address() + "\nItems:\n" + event.items() + "\nTrack: " + link
                // Staff detail page (the only way to open an order kept off the agenda, e.g. a payment review).
                + (event.orderId() == null || event.kind() == OrderNotification.Kind.CANCELLED ? ""
                        : "\nStaff: " + properties.shop().publicBaseUrl().replaceAll("/+$", "") + "/staff/orders/" + event.orderId());
        for (String owner : properties.mail().ownerEmails()) send(owner, subject, ownerBody);
        // Customer e-mails are chosen and rendered by CustomerMailComposer and arrive here as CustomerMail.
    }

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCustomerMail(com.artwithgab.awg_tracking.service.mail.CustomerMail mail) {
        sendHtml(mail.recipient(), mail.subject(), mail.text(), mail.html());
    }

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onInvoiceIssued(InvoiceIssued event) {
        invoices.deliver(event.number(), this::sendInvoice);
    }

    private Boolean sendInvoice(com.artwithgab.awg_tracking.model.Invoice invoice) {
        try {
            JavaMailSender mail = sender.getIfAvailable();
            if (host == null || host.isBlank() || properties.mail().from() == null || properties.mail().from().isBlank() || mail == null) {
                log.info("Invoice e-mail not sent (mail not configured): {}", invoice.getNumber());
                return null;
            }
            var message = mail.createMimeMessage();
            var helper = new org.springframework.mail.javamail.MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(header(properties.mail().from()));
            helper.setTo(header(invoice.getRecipient()));
            helper.setSubject(header(invoice.getSubject()));
            String html = "<!doctype html><html><body><pre style=\"font-family:Arial,sans-serif;white-space:pre-wrap\">"
                    + org.springframework.web.util.HtmlUtils.htmlEscape(invoice.getBody()) + "</pre></body></html>";
            helper.setText(invoice.getBody(), html);
            mail.send(message);
            return true;
        } catch (Exception e) {
            logMailFailure(e);
            return false;
        }
    }

    /**
     * Waitlist double opt-in. The token travels in the URL fragment (after #), so it never reaches
     * server logs; the page posts it to the API.
     */
    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onWaitlistConfirmation(WaitlistConfirmation event) {
        String base = properties.shop().publicBaseUrl().replaceAll("/+$", "");
        String confirm = base + "/waitlist/confirm#" + event.token();
        String leave = base + "/waitlist/unsubscribe#" + event.token();
        boolean en = "en".equals(event.locale());
        var rendered = com.artwithgab.awg_tracking.service.mail.CustomerMailTemplates.waitlist(en, confirm, leave,
                properties.mail().contactEmail(), base);
        sendHtml(event.email(), rendered.subject(), rendered.text(), rendered.html());
    }

    private void send(String recipient, String subject, String body) {
        subject = header(subject);
        try {
            JavaMailSender mail = sender.getIfAvailable();
            if (host == null || host.isBlank() || properties.mail().from() == null || properties.mail().from().isBlank() || mail == null) {
                log.info("E-mail not sent (mail not configured): {}", subject);
                return;
            }
            if (recipient == null || recipient.isBlank()) {
                log.info("E-mail not sent (no recipient yet): {}", subject);
                return;
            }
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(header(properties.mail().from()));
            message.setTo(header(recipient));
            message.setSubject(subject);
            message.setText(body);
            mail.send(message);
        } catch (Exception e) {
            logMailFailure(e);
        }
    }

    /** Customer e-mail: HTML with a plain-text alternative; replies go to the configured reply-to address. */
    private void sendHtml(String recipient, String subject, String text, String html) {
        subject = header(subject);
        try {
            JavaMailSender mail = sender.getIfAvailable();
            if (host == null || host.isBlank() || properties.mail().from() == null || properties.mail().from().isBlank() || mail == null) {
                log.info("E-mail not sent (mail not configured): {}", subject);
                return;
            }
            if (recipient == null || recipient.isBlank()) {
                log.info("E-mail not sent (no recipient yet): {}", subject);
                return;
            }
            var message = mail.createMimeMessage();
            var helper = new org.springframework.mail.javamail.MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(header(properties.mail().from()));
            helper.setTo(header(recipient));
            String replyTo = properties.mail().replyTo();
            if (replyTo != null && !replyTo.isBlank()) helper.setReplyTo(header(replyTo));
            helper.setSubject(subject);
            helper.setText(text, html);
            mail.send(message);
        } catch (Exception e) {
            logMailFailure(e);
        }
    }

    /** SMTP messages and throwable traces can contain recipients, server replies and message bodies. */
    private static void logMailFailure(Exception failure) {
        int smtpCode = 0;
        java.util.Set<Throwable> visited = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        java.util.Deque<Throwable> pending = new java.util.ArrayDeque<>();
        pending.add(failure);
        while (!pending.isEmpty() && visited.size() < 32) {
            Throwable current = pending.removeFirst();
            if (!visited.add(current)) continue;
            if (current instanceof org.eclipse.angus.mail.smtp.SMTPAddressFailedException smtp) smtpCode = smtp.getReturnCode();
            if (current instanceof org.eclipse.angus.mail.smtp.SMTPSendFailedException smtp) smtpCode = smtp.getReturnCode();
            if (current.getCause() != null) pending.add(current.getCause());
            if (current instanceof jakarta.mail.MessagingException mail && mail.getNextException() != null) pending.add(mail.getNextException());
            if (current instanceof org.springframework.mail.MailSendException mail) pending.addAll(java.util.List.of(mail.getMessageExceptions()));
        }
        log.warn("Mail delivery failed: exception={} smtpCode={}", failure.getClass().getSimpleName(), smtpCode);
    }

    private static String header(String value) { return value == null ? "" : value.replace("\r", "").replace("\n", ""); }
}
