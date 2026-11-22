package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NotificationAbuseTests {
    private final JavaMailSender mail = mock(JavaMailSender.class);
    private final InvoiceService invoices = mock(InvoiceService.class);
    private NotificationService service;
    private final MutableClock clock = new MutableClock();
    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-12T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }

    @BeforeEach void setup() {
        @SuppressWarnings("unchecked") ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mail);
        when(mail.createMimeMessage()).thenAnswer(call -> new jakarta.mail.internet.MimeMessage((jakarta.mail.Session) null));
        var props = mock(AwgProperties.class);
        var shop = mock(AwgProperties.Shop.class);
        when(props.shop()).thenReturn(shop);
        when(shop.publicBaseUrl()).thenReturn("https://example.com");
        when(props.mail()).thenReturn(new AwgProperties.Mail("shop@example.com", "owner@example.com"));
        service = new NotificationService(provider, props, invoices, new RateLimiter(clock));
        ReflectionTestUtils.setField(service, "host", "smtp.example.com");
    }

    private Order order() {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setCode("AWGABC123");
        Customer customer = new Customer();
        customer.setName("Injected promotion https://evil.example");
        customer.setEmail("customer@example.com");
        order.setCustomer(customer);
        order.setTotal(BigDecimal.TEN);
        return order;
    }

    @Test void noCustomerMailForAnyUnconfirmedWebEvent() {
        for (CheckoutStatus state : new CheckoutStatus[]{CheckoutStatus.PENDING, CheckoutStatus.REVIEW}) {
            for (OrderNotification.Kind kind : OrderNotification.Kind.values()) {
                Order order = order();
                order.setSource(OrderSource.WEB);
                order.setCheckoutStatus(state);
                service.onOrderNotification(OrderNotification.from(order, kind));
            }
        }
        var sent = org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(mail, atLeastOnce()).send(sent.capture());
        assertTrue(sent.getAllValues().stream().allMatch(m -> to(m).equals("owner@example.com")));
    }

    @Test void ownerEditNoticesShareOneFifteenMinuteBudgetPerOrder() {
        Order order = order();
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.FORM_SUBMITTED));
        clock.now = clock.now.plusSeconds(899);
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        verify(mail, times(1)).send(any(MimeMessage.class));
        clock.now = clock.now.plusSeconds(1);
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.FORM_SUBMITTED));
        verify(mail, times(2)).send(any(MimeMessage.class));
        // A different order is not silenced, nor are payment events for the same order.
        service.onOrderNotification(OrderNotification.from(order(), OrderNotification.Kind.ADDRESS_CHANGED));
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.PAYMENT_CHANGED));
        var sent = org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(mail, times(4)).send(sent.capture());
        // Order events only notify the owner here; customer e-mails come from CustomerMailComposer.
        assertTrue(sent.getAllValues().stream().allMatch(m -> to(m).equals("owner@example.com")));
    }

    @Test void everyOwnerAddressGetsTheNotice() {
        var props = (AwgProperties) ReflectionTestUtils.getField(service, "properties");
        when(props.mail()).thenReturn(new AwgProperties.Mail("shop@example.com", "owner@example.com, personal@example.com"));
        service.onOrderNotification(OrderNotification.from(order(), OrderNotification.Kind.WEB_PAID));
        var sent = org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(mail, times(2)).send(sent.capture());
        assertEquals(java.util.List.of("owner@example.com", "personal@example.com"), sent.getAllValues().stream().map(NotificationAbuseTests::to).toList());
    }

    @Test void smtpFailuresLogOnlyExceptionClassAndNumericCodeForRegularAndInvoiceMail() throws Exception {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(NotificationService.class);
        var logs = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        logs.start();
        logger.addAppender(logs);
        try {
            var smtp = new org.eclipse.angus.mail.smtp.SMTPAddressFailedException(
                    new jakarta.mail.internet.InternetAddress("secret-recipient@example.com"), "RCPT TO", 550, "secret SMTP reply");
            var failure = new org.springframework.mail.MailSendException("secret-recipient@example.com", smtp);
            doThrow(failure).when(mail).send(any(MimeMessage.class));
            service.onOrderNotification(OrderNotification.from(order(), OrderNotification.Kind.PAYMENT_CHANGED));
            var invoice = new Invoice();
            invoice.setRecipient("customer@example.com");
            invoice.setSubject("Invoice");
            invoice.setBody("Body");
            doAnswer(call -> {
                java.util.function.Function<Invoice, Boolean> send = call.getArgument(1);
                assertFalse(send.apply(invoice));
                return null;
            }).when(invoices).deliver(eq(1L), any());
            service.onInvoiceIssued(new InvoiceIssued(1L));
            service.onCustomerMail(new com.artwithgab.awg_tracking.service.mail.CustomerMail("customer@example.com", "Subject", "Text", "<p>Html</p>"));
            assertEquals(3, logs.list.size());
            assertTrue(logs.list.stream().allMatch(e -> e.getFormattedMessage().equals("Mail delivery failed: exception=MailSendException smtpCode=550")
                    && e.getThrowableProxy() == null));
        } finally {
            logger.detachAppender(logs);
            logs.stop();
        }
    }

    @Test void ownerNoticeIsHtmlFromTheBrandAndRepliesGoToTheCustomer() throws Exception {
        service.onOrderNotification(OrderNotification.from(order(), OrderNotification.Kind.WEB_PAID));
        var sent = org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(mail).send(sent.capture());
        MimeMessage m = sent.getValue();
        m.saveChanges();
        assertEquals("ArtWithGab <shop@example.com>", m.getFrom()[0].toString());
        assertEquals("customer@example.com", m.getReplyTo()[0].toString());
        assertTrue(m.getContentType().startsWith("multipart/"), "HTML with a text alternative");
    }

    private static String to(MimeMessage m) {
        try { return m.getRecipients(jakarta.mail.Message.RecipientType.TO)[0].toString(); }
        catch (jakarta.mail.MessagingException e) { throw new IllegalStateException(e); }
    }
}
