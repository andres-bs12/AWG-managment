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
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
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
        "awg.post.collection-from=2026-11-30",
        "awg.post.paint-from=",
    "spring.datasource.url=jdbc:h2:mem:notifications;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
    "spring.mail.host=mail.example.com", "awg.mail.from=shop@example.com", "awg.mail.owner-email=owner@example.com",
    "awg.invoice.business-name=Test Seller", "awg.invoice.address=Teststrasse 1, 1010 Wien", "awg.invoice.tax-note=Test tax note"
})
class NotificationServiceTests {
    @Autowired OrderService orders;
    @Autowired com.artwithgab.awg_tracking.repository.MarketOrnamentRepository marketStock;
    @Autowired TransactionTemplate transactions;
    @Autowired com.artwithgab.awg_tracking.repository.InvoiceRepository invoices;
    @Autowired com.artwithgab.awg_tracking.repository.InvoiceCounterRepository counters;
    @MockitoBean JavaMailSender mail;

    @org.junit.jupiter.api.BeforeEach void mimeMessages() {
        when(mail.createMimeMessage()).thenAnswer(invocation -> new jakarta.mail.internet.MimeMessage((jakarta.mail.Session) null));
    }

    @Test void salePaymentAndCancellationAreSentAfterCommit() {
        var piece = new com.artwithgab.awg_tracking.model.MarketOrnament();
        piece.setId("RM" + UUID.randomUUID().toString().substring(0, 6));
        piece.setStatus("painted");
        marketStock.saveAndFlush(piece);
        var item = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, null, null, DeliveryKind.MARKET, null, null, null, null, piece.getId());
        var order = orders.createSale(new CreateSaleRequest(null, "<b>Customer</b>", "", "customer@example.com", List.of(item), null));
        UUID id = UUID.fromString(order.id());
        try {
            orders.updatePaymentState(id, PaymentState.PAID, PaymentMethod.CASH, null);
        } finally {
            orders.cancelOrder(id);
        }
        // Owner notices (sale created, payment, cancellation) and customer mails are all HTML now; the
        // customer gets one e-mail per event, plus the invoice (seller data is configured in this test).
        var all = org.mockito.ArgumentCaptor.forClass(jakarta.mail.internet.MimeMessage.class);
        verify(mail, timeout(5000).times(7)).send(all.capture());
        var notices = all.getAllValues().stream().filter(m -> "owner@example.com".equals(recipient(m))).toList();
        assertEquals(3, notices.size());
        assertTrue(notices.stream().allMatch(m -> subjectOf(m).startsWith("ArtWithGab: ") && subjectOf(m).endsWith(order.code())));
        var mime = new Object() { List<jakarta.mail.internet.MimeMessage> getAllValues() {
            return all.getAllValues().stream().filter(m -> "customer@example.com".equals(recipient(m))).toList(); } };
        assertEquals(4, mime.getAllValues().size());
        try {
            var bySubject = new java.util.HashMap<String, jakarta.mail.internet.MimeMessage>();
            for (var m : mime.getAllValues()) { m.saveChanges(); bySubject.put(m.getSubject(), m); }
            assertTrue(bySubject.containsKey("Deine Bestellung " + order.code() + " ist bestätigt"));
            assertTrue(bySubject.containsKey("Zahlung erhalten · " + order.code()));
            assertTrue(bySubject.containsKey("Deine Bestellung " + order.code() + " wurde storniert"));
            var invoiceMail = bySubject.entrySet().stream().filter(e -> e.getKey().startsWith("Rechnung ")).findFirst().orElseThrow().getValue();
            assertEquals("customer@example.com", invoiceMail.getAllRecipients()[0].toString());
            String plain = textPart(invoiceMail, "text/plain");
            String html = textPart(invoiceMail, "text/html");
            assertTrue(plain.contains("Offener Betrag: 0,00 EUR") && plain.contains(order.code()));
            assertTrue(html.contains("<pre") && html.contains(order.code()));
            assertTrue(plain.contains("<b>Customer</b>"));
            assertTrue(html.contains("&lt;b&gt;Customer&lt;/b&gt;") && !html.contains("<b>Customer</b>"));
            for (String subject : List.of("Deine Bestellung " + order.code() + " ist bestätigt", "Zahlung erhalten · " + order.code())) {
                var customerMail = bySubject.get(subject);
                assertEquals("customer@example.com", customerMail.getAllRecipients()[0].toString());
                String customerHtml = textPart(customerMail, "text/html");
                String customerText = textPart(customerMail, "text/plain");
                assertTrue(customerHtml.contains("/track/" + order.code()) && customerText.contains("/track/" + order.code()));
                assertTrue(customerHtml.contains("@art_withgab_") && customerHtml.contains("artwithgab@gmail.com"));
                assertFalse(customerHtml.contains("<b>Customer</b>"));
            }
        } catch (Exception e) { throw new AssertionError(e); }
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.NullSource
    @org.junit.jupiter.params.provider.ValueSource(strings = "AT12345678")
    void customerGetsOneShippedMailAfterEveryPostItemIsHandedOver(String trackingNumber) {
        var address = new com.artwithgab.awg_tracking.dto.common.AddressDto("Hauptplatz 1", null, "Linz", "4020");
        var finishedPost = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, null, null,
                DeliveryKind.POST, null, null, null, address, readyMarketPiece());
        // The shipped order is committed, so each invocation needs a different paint slot.
        LocalDate paintDate = LocalDate.of(2026, 11, trackingNumber == null ? 25 : 26);
        var customPost = new CreateSaleItemRequest(ItemKind.CUSTOM, false, CustomColor.RED, CustomFinish.SHINY, com.artwithgab.awg_tracking.enums.OrnamentSize.BIG,
                paintDate, 10.0, 11.0, DeliveryKind.POST, null, null, null, address, null);
        var pickup = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, null, null,
                DeliveryKind.MARKET, null, null, null, null, readyMarketPiece());
        var order = orders.createSale(new CreateSaleRequest(null, "Customer", "", "customer@example.com", List.of(pickup, finishedPost, customPost), null));
        UUID id = UUID.fromString(order.id());
        String subject = "Deine Bestellung ist unterwegs · " + order.code();
        var firstPost = List.of(UUID.fromString(order.itemIds().get(1)));
        var lastPost = List.of(UUID.fromString(order.itemIds().get(2)));
        orders.setHandedOver(id, true, firstPost, trackingNumber);
        verify(mail, after(300).never()).send(org.mockito.ArgumentMatchers.<jakarta.mail.internet.MimeMessage>argThat(m -> subject.equals(subjectOf(m))));

        orders.setItemStatus(id, lastPost.getFirst(), ProductionStatus.FINISHED);
        orders.setHandedOver(id, true, lastPost);
        orders.setHandedOver(id, true, lastPost);
        // Customer: order confirmed, ready for the market pickup, and exactly one "on its way".
        // Owner notices go to another address; wait until the customer's three mails were sent.
        var customer = customerMails(3);
        assertEquals(3, customer.size(), "order confirmed, ready for the market pickup, on its way");
        var shipped = customer.stream().filter(m -> subject.equals(subjectOf(m))).toList();
        assertEquals(1, shipped.size());
        try {
            String text = textPart(shipped.getFirst(), "text/plain");
            assertTrue(text.contains("3.–4. Dezember 2026"));
            assertEquals(trackingNumber != null, text.contains("https://www.post.at/s/sendungsdetails?snr=AT12345678"));
        } catch (Exception e) { throw new AssertionError(e); }
        assertFalse(orders.getOrder(id).handedOver());
        assertTrue(invoices.findByOrderIdOrderByNumberAsc(id).isEmpty());
    }

    @Test void rolledBackSaleDoesNotSend() {
        var piece = new com.artwithgab.awg_tracking.model.MarketOrnament();
        piece.setId("RM" + UUID.randomUUID().toString().substring(0, 6));
        piece.setStatus("painted");
        marketStock.saveAndFlush(piece);
        var item = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, null, null, DeliveryKind.MARKET, null, null, null, null, piece.getId());
        long before = invoices.count();
        long numberBefore = counters.findById(1L).orElseThrow().getLastNumber();
        transactions.executeWithoutResult(status -> {
            var order = orders.createSale(new CreateSaleRequest(null, "Customer", "", "customer@example.com", List.of(item), null));
            orders.updatePaymentState(UUID.fromString(order.id()), PaymentState.DEPOSIT, PaymentMethod.CASH, null);
            assertEquals(before + 1, invoices.count());
            status.setRollbackOnly();
        });
        assertEquals(before, invoices.count());
        assertEquals(numberBefore, counters.findById(1L).orElseThrow().getLastNumber());
        verify(mail, after(300).never()).send(any(jakarta.mail.internet.MimeMessage.class));
    }

    private String readyMarketPiece() {
        var piece = new com.artwithgab.awg_tracking.model.MarketOrnament();
        piece.setId("RM" + UUID.randomUUID().toString().substring(0, 6));
        piece.setStatus("painted");
        return marketStock.saveAndFlush(piece).getId();
    }

    /** Polls the async mail sends until {@code expected} customer mails arrived (or 5 s passed), then waits for strays. */
    private List<jakarta.mail.internet.MimeMessage> customerMails(int expected) {
        long end = System.currentTimeMillis() + 5000;
        List<jakarta.mail.internet.MimeMessage> found = List.of();
        while (System.currentTimeMillis() < end) {
            found = org.mockito.Mockito.mockingDetails(mail).getInvocations().stream()
                    .filter(i -> i.getMethod().getName().equals("send") && i.getArgument(0) instanceof jakarta.mail.internet.MimeMessage)
                    .map(i -> (jakarta.mail.internet.MimeMessage) i.getArgument(0))
                    .filter(m -> "customer@example.com".equals(recipient(m))).toList();
            if (found.size() >= expected) break;
            try { Thread.sleep(50); } catch (InterruptedException e) { Thread.currentThread().interrupt(); break; }
        }
        try { Thread.sleep(300); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        return org.mockito.Mockito.mockingDetails(mail).getInvocations().stream()
                .filter(i -> i.getMethod().getName().equals("send") && i.getArgument(0) instanceof jakarta.mail.internet.MimeMessage)
                .map(i -> (jakarta.mail.internet.MimeMessage) i.getArgument(0))
                .filter(m -> "customer@example.com".equals(recipient(m))).toList();
    }

    @Test void collectingTheRestAtHandoverSendsOnlyTheThankYou() {
        var piece = readyMarketPiece();
        var item = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, null, null, DeliveryKind.MARKET, null, null, null, null, piece);
        var order = orders.createSale(new CreateSaleRequest(null, "Customer", "", "customer@example.com", List.of(item), null));
        UUID id = UUID.fromString(order.id());
        orders.setHandedOver(id, true, null, null, PaymentMethod.CASH);
        var subjects = customerMails(2).stream().map(NotificationServiceTests::subjectOf).toList();
        assertTrue(subjects.contains("Deine Bestellung " + order.code() + " ist bestätigt"), subjects.toString());
        assertTrue(subjects.stream().anyMatch(s -> s.startsWith("Danke für deinen Besuch")), subjects.toString());
        assertFalse(subjects.stream().anyMatch(s -> s.startsWith("Zahlung erhalten")), "the thank-you already shows the payment: " + subjects);
        assertEquals(PaymentState.PAID, orders.getOrder(id).paymentState());
    }

    private static String recipient(jakarta.mail.internet.MimeMessage m) {
        try { return m.getRecipients(jakarta.mail.Message.RecipientType.TO)[0].toString(); }
        catch (jakarta.mail.MessagingException e) { throw new IllegalStateException(e); }
    }

    private static String subjectOf(jakarta.mail.internet.MimeMessage message) {
        try { return message == null ? null : message.getSubject(); } catch (jakarta.mail.MessagingException e) { throw new AssertionError(e); }
    }

    private static String textPart(jakarta.mail.Part part, String type) throws Exception {
        if (part instanceof jakarta.mail.internet.MimeMessage message) message.saveChanges();
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
        NotificationService service = new NotificationService(provider, properties, invoiceDelivery, new com.artwithgab.awg_tracking.security.RateLimiter(java.time.Clock.systemUTC()));
        ReflectionTestUtils.setField(service, "host", "");
        service.onOrderNotification(new OrderNotification(OrderNotification.Kind.CANCELLED, "AWG1234", "Customer", "customer@example.com",
                BigDecimal.TEN, BigDecimal.ZERO, "UNPAID", "", "", null, false, null, null, null));
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
