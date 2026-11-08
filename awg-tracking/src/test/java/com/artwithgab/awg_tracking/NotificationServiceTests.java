package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.dto.order.*;
import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.service.OrderService;
import com.artwithgab.awg_tracking.service.OrderNotification;
import com.artwithgab.awg_tracking.service.NotificationService;
import com.artwithgab.awg_tracking.config.AwgProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.util.List;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Import(TestClockConfig.class)
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:notifications;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
    "spring.mail.host=mail.example.com", "awg.mail.from=shop@example.com", "awg.mail.owner-email=owner@example.com",
    "awg.invoice.business-name=Test Seller", "awg.invoice.address=Teststrasse 1, 1010 Wien", "awg.invoice.tax-note=Test tax note"
})
class NotificationServiceTests {
    @Autowired OrderService orders;
    @Autowired TransactionTemplate transactions;
    @Autowired com.artwithgab.awg_tracking.repository.InvoiceRepository invoices;
    @Autowired com.artwithgab.awg_tracking.repository.InvoiceCounterRepository counters;
    @MockitoBean JavaMailSender mail;

    @org.junit.jupiter.api.BeforeEach void mimeMessages() {
        when(mail.createMimeMessage()).thenAnswer(invocation -> new jakarta.mail.internet.MimeMessage((jakarta.mail.Session) null));
    }

    @Test void salePaymentAndCancellationAreSentAfterCommit() {
        var item = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, null, DeliveryKind.MARKET, null, null, null, null);
        var order = orders.createSale(new CreateSaleRequest(null, "<b>Customer</b>", "", "customer@example.com", List.of(item)));
        UUID id = UUID.fromString(order.id());
        try {
            orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
        } finally {
            orders.cancelOrder(id);
        }
        var messages = org.mockito.ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail, timeout(5000).times(6)).send(messages.capture());
        assertEquals(3, messages.getAllValues().stream().filter(m -> m.getTo()[0].equals("owner@example.com")).count());
        assertEquals(3, messages.getAllValues().stream().filter(m -> m.getTo()[0].equals("customer@example.com")).count());
        assertTrue(messages.getAllValues().stream().allMatch(m -> m.getText().contains(order.code())));
        var invoiceMail = org.mockito.ArgumentCaptor.forClass(jakarta.mail.internet.MimeMessage.class);
        verify(mail, timeout(5000).times(1)).send(invoiceMail.capture());
        try {
            assertTrue(invoiceMail.getValue().getSubject().startsWith("Rechnung "));
            assertEquals("customer@example.com", invoiceMail.getValue().getAllRecipients()[0].toString());
            invoiceMail.getValue().saveChanges();
            String plain = textPart(invoiceMail.getValue(), "text/plain");
            String html = textPart(invoiceMail.getValue(), "text/html");
            assertTrue(plain.contains("Offener Betrag: 0,00 EUR") && plain.contains(order.code()));
            assertTrue(html.contains("<pre") && html.contains(order.code()));
            assertTrue(plain.contains("<b>Customer</b>"));
            assertTrue(html.contains("&lt;b&gt;Customer&lt;/b&gt;") && !html.contains("<b>Customer</b>"));
        } catch (Exception e) { throw new AssertionError(e); }
        assertTrue(messages.getAllValues().stream().anyMatch(m -> m.getSubject().contains("cancelled")));
        assertTrue(messages.getAllValues().stream().filter(m -> m.getTo()[0].equals("customer@example.com"))
                .allMatch(m -> m.getText().contains("/track/" + order.code()) && m.getText().contains("Hallo") && m.getText().contains("Hello")));
    }
    @Test void rolledBackSaleDoesNotSend() {
        var item = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, null, DeliveryKind.MARKET, null, null, null, null);
        long before = invoices.count();
        long numberBefore = counters.findById(1L).orElseThrow().getLastNumber();
        transactions.executeWithoutResult(status -> {
            var order = orders.createSale(new CreateSaleRequest(null, "Customer", "", "customer@example.com", List.of(item)));
            orders.updatePaymentState(UUID.fromString(order.id()), PaymentState.DEPOSIT, PaymentMethod.CASH, null);
            assertEquals(before + 1, invoices.count());
            status.setRollbackOnly();
        });
        assertEquals(before, invoices.count());
        assertEquals(numberBefore, counters.findById(1L).orElseThrow().getLastNumber());
        verify(mail, after(300).never()).send(any(SimpleMailMessage.class));
        verify(mail, never()).send(any(jakarta.mail.internet.MimeMessage.class));
    }

    private static String textPart(jakarta.mail.Part part, String type) throws Exception {
        if (part.isMimeType(type)) return (String) part.getContent();
        if (part.getContent() instanceof jakarta.mail.Multipart parts) {
            for (int i = 0; i < parts.getCount(); i++) {
                String found = textPart(parts.getBodyPart(i), type);
                if (found != null) return found;
            }
        }
        return null;
    }

    @Test void noMailIsSentWithoutHost() {
        @SuppressWarnings("unchecked") ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mail);
        AwgProperties properties = mock(AwgProperties.class);
        AwgProperties.Shop shop = mock(AwgProperties.Shop.class);
        when(properties.shop()).thenReturn(shop);
        when(shop.publicBaseUrl()).thenReturn("https://example.com");
        when(properties.mail()).thenReturn(new AwgProperties.Mail("shop@example.com", "owner@example.com"));
        var invoiceDelivery = mock(com.artwithgab.awg_tracking.service.InvoiceService.class);
        NotificationService service = new NotificationService(provider, properties, invoiceDelivery);
        ReflectionTestUtils.setField(service, "host", "");
        service.onOrderNotification(new OrderNotification(OrderNotification.Kind.CANCELLED, "AWG1234", "Customer", "customer@example.com",
                BigDecimal.TEN, BigDecimal.ZERO, "UNPAID", "", "", null));
        var invoice = new com.artwithgab.awg_tracking.model.Invoice();
        invoice.setNumber(1L);
        invoice.setRecipient("customer@example.com");
        invoice.setSubject("Rechnung 1");
        invoice.setBody("Invoice body");
        doAnswer(invocation -> {
            java.util.function.Function<com.artwithgab.awg_tracking.model.Invoice, Boolean> send = invocation.getArgument(1);
            org.junit.jupiter.api.Assertions.assertNull(send.apply(invoice));
            return null;
        }).when(invoiceDelivery).deliver(eq(1L), any());
        service.onInvoiceIssued(new com.artwithgab.awg_tracking.service.InvoiceIssued(1L));
        verifyNoInteractions(mail);
    }
}
