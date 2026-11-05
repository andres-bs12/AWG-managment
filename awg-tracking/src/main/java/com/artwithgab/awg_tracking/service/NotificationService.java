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
    @Value("${spring.mail.host:}") private String host;

    @Async("notificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderNotification(OrderNotification event) {
        String link = properties.shop().publicBaseUrl().replaceAll("/+$", "") + "/track/" + URLEncoder.encode(event.code(), StandardCharsets.UTF_8);
        String subject = "ArtWithGab: " + event.kind().owner + " - " + event.code();
        String ownerBody = "Order: " + event.code() + "\nCustomer: " + event.customerName() + "\nEmail: " + event.customerEmail()
                + "\nTotal: " + event.total() + " EUR\nAmount paid: " + event.amountPaid() + " EUR\nPayment: " + event.paymentState()
                + "\nAddress: " + event.address() + "\nItems:\n" + event.items() + "\nTrack: " + link
                // Staff detail page (the only way to open an order kept off the agenda, e.g. a payment review).
                + (event.orderId() == null || event.kind() == OrderNotification.Kind.CANCELLED ? ""
                        : "\nStaff: " + properties.shop().publicBaseUrl().replaceAll("/+$", "") + "/staff/orders/" + event.orderId());
        send(properties.mail().ownerEmail(), subject, ownerBody);
        boolean ownerOnly = event.kind() == OrderNotification.Kind.FORM_SUBMITTED || event.kind() == OrderNotification.Kind.PAYMENT_REVIEW;
        if (!ownerOnly) {
            String body = greeting("Hallo", event.customerName()) + event.kind().german + ".\nBestellung: " + event.code()
                    + "\nGesamt: " + event.total() + " EUR · Bezahlt: " + event.amountPaid() + " EUR\nVerfolge deine Bestellung: " + link + "\n\nVielen Dank!\nArtWithGab\n\n---\n\n" + greeting("Hello", event.customerName()) + event.kind().english + ".\nOrder: " + event.code() + "\nTotal: " + event.total() + " EUR · Paid: " + event.amountPaid() + " EUR\nTrack your order: " + link + "\n\nThank you!\nArtWithGab";
            send(event.customerEmail(), subject, body);
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
        String subject = en ? "ArtWithGab: please confirm your e-mail" : "ArtWithGab: bitte bestätige deine E-Mail";
        String body = en
                ? "Hello,\n\nyou asked us to tell you when orders for hand-painted pet ornaments open again.\n"
                  + "Please confirm your e-mail address: " + confirm
                  + "\n\nIf this was not you, ignore this e-mail; we delete unconfirmed addresses after a week.\n"
                  + "Remove your address at any time: " + leave + "\n\nArtWithGab"
                : "Hallo,\n\ndu möchtest erfahren, wann wieder Bestellungen für handbemalte Tierkugeln möglich sind.\n"
                  + "Bitte bestätige deine E-Mail-Adresse: " + confirm
                  + "\n\nWarst du das nicht? Dann ignoriere diese E-Mail; unbestätigte Adressen löschen wir nach einer Woche.\n"
                  + "Du kannst dich jederzeit abmelden: " + leave + "\n\nArtWithGab";
        send(event.email(), subject, body);
    }

    private void send(String recipient, String subject, String body) {
        subject = header(subject);
        try {
            JavaMailSender mail = sender.getIfAvailable();
            if (host == null || host.isBlank() || recipient == null || recipient.isBlank() || properties.mail().from() == null || properties.mail().from().isBlank() || mail == null) {
                log.info("E-mail not sent (mail not configured): {}", subject);
                return;
            }
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(header(properties.mail().from()));
            message.setTo(header(recipient));
            message.setSubject(subject);
            message.setText(body);
            mail.send(message);
        } catch (Exception e) {
            log.warn("Could not send e-mail: {}", subject, e);
        }
    }

    private static String greeting(String hello, String name) {
        String clean = header(name).trim();
        return (clean.isEmpty() ? hello : hello + " " + clean) + ",\n\n";
    }

    private static String header(String value) { return value == null ? "" : value.replace("\r", "").replace("\n", ""); }
}
