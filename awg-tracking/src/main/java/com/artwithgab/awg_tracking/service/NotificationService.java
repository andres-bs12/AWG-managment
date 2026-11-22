package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
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
        String base = properties.shop().publicBaseUrl().replaceAll("/+$", "");
        String link = base + "/track/" + URLEncoder.encode(event.code(), StandardCharsets.UTF_8);
        // Staff detail page (the only way to open an order kept off the agenda, e.g. a payment review).
        String staff = event.orderId() == null || event.kind() == OrderNotification.Kind.CANCELLED ? null : base + "/staff/orders/" + event.orderId();
        var notice = com.artwithgab.awg_tracking.service.mail.CustomerMailTemplates.owner(new com.artwithgab.awg_tracking.service.mail.CustomerMailTemplates.OwnerNotice(
                event.kind().owner, event.code(), event.customerName(), event.customerEmail(), plain(event.total()), plain(event.amountPaid()),
                event.paymentState(), event.address(), event.items() == null || event.items().isBlank() ? java.util.List.of() : java.util.List.of(event.items().split("\n")),
                staff, link, base));
        // No customer Reply-To: the QR form accepts any address, so a reply could reach a stranger.
        for (String owner : properties.mail().ownerEmails()) sendHtml(owner, notice.subject(), notice.text(), notice.html(), null);
        // Customer e-mails are chosen and rendered by CustomerMailComposer and arrive here as CustomerMail.
    }

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCustomerMail(com.artwithgab.awg_tracking.service.mail.CustomerMail mail) {
        sendHtml(mail.recipient(), mail.subject(), mail.text(), mail.html(), properties.mail().replyTo());
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
            helper.setFrom(from());
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
        sendHtml(event.email(), rendered.subject(), rendered.text(), rendered.html(), properties.mail().replyTo());
    }

    /** HTML mail with a plain-text alternative, sent as "ArtWithGab <from>". */
    private void sendHtml(String recipient, String subject, String text, String html, String replyTo) {
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
            helper.setFrom(from());
            helper.setTo(header(recipient));
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

    /** Inboxes show the brand instead of the bare "hello@" address. */
    private String from() {
        String from = header(properties.mail().from());
        return from.contains("<") ? from : SENDER_NAME + " <" + from + ">";
    }

    static final String SENDER_NAME = "ArtWithGab";

    private static String plain(java.math.BigDecimal value) {
        return (value == null ? java.math.BigDecimal.ZERO : value).setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private static String header(String value) { return value == null ? "" : value.replace("\r", "").replace("\n", ""); }
}
