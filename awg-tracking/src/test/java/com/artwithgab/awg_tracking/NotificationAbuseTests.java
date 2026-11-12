package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
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
        var sent = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail, atLeastOnce()).send(sent.capture());
        assertTrue(sent.getAllValues().stream().allMatch(m -> Arrays.equals(m.getTo(), new String[]{"owner@example.com"})));
    }

    @Test void addressAndFormShareOneFifteenMinuteBudgetPerOrderAndUseNeutralGreeting() {
        Order order = order();
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.FORM_SUBMITTED));
        clock.now = clock.now.plusSeconds(899);
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        verify(mail, times(2)).send(any(SimpleMailMessage.class));
        clock.now = clock.now.plusSeconds(1);
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.FORM_SUBMITTED));
        verify(mail, times(3)).send(any(SimpleMailMessage.class));
        // A different order is not silenced, nor are payment events for the same order.
        service.onOrderNotification(OrderNotification.from(order(), OrderNotification.Kind.ADDRESS_CHANGED));
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.PAYMENT_CHANGED));
        var sent = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail, times(7)).send(sent.capture());
        var addressMails = sent.getAllValues().stream().filter(m -> m.getTo()[0].equals("customer@example.com")
                && m.getSubject().contains("address")).toList();
        assertEquals(2, addressMails.size());
        assertTrue(addressMails.stream().allMatch(m -> m.getText().startsWith("Hallo,\n\n") && !m.getText().contains("evil.example")));
    }

    @Test void formFirstAlsoSuppressesAddressMailUntilWindowExpires() {
        Order order = order();
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.FORM_SUBMITTED));
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        var sent = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail).send(sent.capture());
        assertEquals("owner@example.com", sent.getValue().getTo()[0]);
        clock.now = clock.now.plusSeconds(900);
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        verify(mail, times(3)).send(any(SimpleMailMessage.class));
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
            doThrow(failure).when(mail).send(any(SimpleMailMessage.class));
            service.onOrderNotification(OrderNotification.from(order(), OrderNotification.Kind.PAYMENT_CHANGED));
            when(mail.createMimeMessage()).thenReturn(new jakarta.mail.internet.MimeMessage((jakarta.mail.Session) null));
            doThrow(failure).when(mail).send(any(jakarta.mail.internet.MimeMessage.class));
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
            assertEquals(3, logs.list.size());
            assertTrue(logs.list.stream().allMatch(e -> e.getFormattedMessage().equals("Mail delivery failed: exception=MailSendException smtpCode=550")
                    && e.getThrowableProxy() == null));
        } finally {
            logger.detachAppender(logs);
            logs.stop();
        }
    }
}
