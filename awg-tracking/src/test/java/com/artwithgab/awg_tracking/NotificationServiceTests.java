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
    "spring.mail.host=mail.example.com", "awg.mail.from=shop@example.com", "awg.mail.owner-email=owner@example.com"
})
class NotificationServiceTests {
    @Autowired OrderService orders;
    @Autowired TransactionTemplate transactions;
    @MockitoBean JavaMailSender mail;

    @Test void salePaymentAndCancellationAreSentAfterCommit() {
        var item = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, DeliveryKind.MARKET, null, null, null, null);
        var order = orders.createSale(new CreateSaleRequest(null, "Customer", "", "customer@example.com", List.of(item)));
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
        assertTrue(messages.getAllValues().stream().anyMatch(m -> m.getSubject().contains("cancelled")));
        assertTrue(messages.getAllValues().stream().filter(m -> m.getTo()[0].equals("customer@example.com"))
                .allMatch(m -> m.getText().contains("/track/" + order.code()) && m.getText().contains("Hallo") && m.getText().contains("Hello")));
    }
    @Test void rolledBackSaleDoesNotSend() {
        var item = new CreateSaleItemRequest(ItemKind.GENERIC, false, null, null, null, null, DeliveryKind.MARKET, null, null, null, null);
        transactions.executeWithoutResult(status -> {
            orders.createSale(new CreateSaleRequest(null, "Customer", "", "customer@example.com", List.of(item)));
            status.setRollbackOnly();
        });
        verify(mail, after(300).never()).send(any(SimpleMailMessage.class));
    }

    @Test void noMailIsSentWithoutHost() {
        @SuppressWarnings("unchecked") ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mail);
        AwgProperties properties = mock(AwgProperties.class);
        AwgProperties.Shop shop = mock(AwgProperties.Shop.class);
        when(properties.shop()).thenReturn(shop);
        when(shop.publicBaseUrl()).thenReturn("https://example.com");
        when(properties.mail()).thenReturn(new AwgProperties.Mail("shop@example.com", "owner@example.com"));
        NotificationService service = new NotificationService(provider, properties);
        ReflectionTestUtils.setField(service, "host", "");
        service.onOrderNotification(new OrderNotification(OrderNotification.Kind.CANCELLED, "AWG1234", "Customer", "customer@example.com",
                BigDecimal.TEN, BigDecimal.ZERO, "UNPAID", "", "", null));
        verifyNoInteractions(mail);
    }
}
