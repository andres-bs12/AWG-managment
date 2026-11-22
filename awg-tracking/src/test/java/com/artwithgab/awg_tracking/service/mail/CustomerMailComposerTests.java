package com.artwithgab.awg_tracking.service.mail;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.CheckoutStatus;
import com.artwithgab.awg_tracking.enums.OrderSource;
import com.artwithgab.awg_tracking.model.Customer;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.repository.MarketDayRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.InvoiceService;
import com.artwithgab.awg_tracking.service.OrderNotification;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.*;

class CustomerMailComposerTests {
    private final OrderRepository orders = mock(OrderRepository.class);
    private final MarketDayRepository days = mock(MarketDayRepository.class);
    private final AwgProperties props = mock(AwgProperties.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-22T10:00:00Z"), ZoneId.of("Europe/Vienna"));
    private final CustomerMailComposer composer = new CustomerMailComposer(orders, days, props, new RateLimiter(clock), events, clock);

    private Order order(String email) {
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setCode("AWGTEST12");
        Customer customer = new Customer();
        customer.setName("Luna Test");
        customer.setEmail(email);
        order.setCustomer(customer);
        order.setTotal(BigDecimal.TEN);
        when(orders.findById(order.getId())).thenReturn(Optional.of(order));
        var shop = mock(AwgProperties.Shop.class);
        when(shop.publicBaseUrl()).thenReturn("https://artwithgab.com");
        when(props.shop()).thenReturn(shop);
        when(props.zone()).thenReturn("Europe/Vienna");
        when(props.mail()).thenReturn(new AwgProperties.Mail("hello@artwithgab.com", "owner@example.com"));
        when(days.findAllWithMarket()).thenReturn(List.of());
        return order;
    }

    @Test void stallCustomerWithoutEmailYetGetsNothing() {
        composer.onOrderNotification(OrderNotification.from(order(""), OrderNotification.Kind.SALE_CREATED));
        verifyNoInteractions(events);
    }

    @Test void unconfirmedWebCheckoutNeverWritesToTheCustomer() {
        Order order = order("luna@example.com");
        order.setSource(OrderSource.WEB);
        order.setCheckoutStatus(CheckoutStatus.PENDING);
        composer.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.CANCELLED));
        verifyNoInteractions(events);
    }

    @Test void addressMailsShareAFifteenMinuteBudgetPerOrder() {
        Order order = order("luna@example.com");
        order.setDeliveryAddress(new com.artwithgab.awg_tracking.model.Address("Gasse 1", null, "Wien", "1010"));
        composer.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        composer.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        verify(events, times(1)).publishEvent(any(CustomerMail.class));
    }

    @Test void customerWithEmailGetsOneRenderedMail() {
        composer.onOrderNotification(OrderNotification.from(order("luna@example.com"), OrderNotification.Kind.CANCELLED));
        verify(events).publishEvent(argThat((Object e) -> e instanceof CustomerMail m && m.recipient().equals("luna@example.com")
                && m.subject().equals("Deine Bestellung AWGTEST12 wurde storniert") && m.html().contains("artwithgab@gmail.com")));
    }

    @Test void withoutSellerDataNoSeparateReceiptIsIssued() {
        var invoices = mock(com.artwithgab.awg_tracking.repository.InvoiceRepository.class);
        var counters = mock(com.artwithgab.awg_tracking.repository.InvoiceCounterRepository.class);
        var invoiceProps = mock(AwgProperties.class);
        when(invoiceProps.invoice()).thenReturn(new AwgProperties.Invoice(null, null, null, null, null));
        var service = new InvoiceService(invoices, counters, orders, days, null, invoiceProps, events, clock);
        Order order = order("luna@example.com");
        service.onOrderNotification(OrderNotification.from(order, OrderNotification.Kind.HANDED_OVER));
        verifyNoInteractions(invoices, counters, events);
    }
}
