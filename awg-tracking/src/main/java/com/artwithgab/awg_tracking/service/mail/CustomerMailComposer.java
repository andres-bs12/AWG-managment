package com.artwithgab.awg_tracking.service.mail;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.repository.MarketDayRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.CalendarIndex;
import com.artwithgab.awg_tracking.service.OrderNotification;
import com.artwithgab.awg_tracking.support.AustrianPost;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Stream;

/**
 * Chooses at most one customer e-mail per order event and renders it while the order is still loaded.
 * Owner notices stay in {@code NotificationService}. Sending happens after commit, so a rolled-back change
 * never reaches the customer.
 */
@Component
@RequiredArgsConstructor
public class CustomerMailComposer {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(CustomerMailComposer.class);
    private static final String[] WEEKDAYS_DE = {"Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"};
    private static final String[] WEEKDAYS_EN = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
    private static final String[] MONTHS_DE = {"Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"};
    private static final String[] MONTHS_EN = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final OrderRepository orders;
    private final MarketDayRepository days;
    private final AwgProperties props;
    private final RateLimiter limiter;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    enum Template { CONFIRMED, PAYMENT, READY, SHIPPED, THANKS, ADDRESS, CANCELLED }

    /**
     * Runs after the order transaction committed, in its own read-only transaction: a problem here can
     * never mark the payment or staff action for rollback.
     */
    @org.springframework.transaction.event.TransactionalEventListener(phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT)
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW, readOnly = true)
    public void onOrderNotification(OrderNotification event) {
        if (event.unconfirmedWeb() || event.orderId() == null) return;
        try {
            compose(event);
        } catch (RuntimeException e) {
            // A rendering problem must never undo the staff action or the payment that triggered it.
            log.warn("Customer e-mail not composed: kind={} exception={}", event.kind(), e.getClass().getSimpleName());
        }
    }

    private void compose(OrderNotification event) {
        Order order = orders.findById(UUID.fromString(event.orderId())).orElse(null);
        if (order == null) return;
        String email = order.getCustomer() == null ? null : order.getCustomer().getEmail();
        if (email == null || email.isBlank()) return;
        Template template = choose(event.kind(), order);
        if (template == null) return;
        // Address edits share a small budget so a customer cannot flood their own inbox.
        if (template == Template.ADDRESS && !limiter.tryAcquire("order-edit-customer-mail", order.getId().toString(), 1, Duration.ofMinutes(15))) return;
        var view = view(order);
        if (template == Template.ADDRESS && view.post() == null) {
            // Legacy Vienna deliveries have no Post data; confirm the saved address all the same.
            view = new CustomerMailTemplates.View(view.en(), view.code(), view.firstName(), view.lines(), view.shippingFee(), view.total(),
                    view.paid(), view.pickup(), new CustomerMailTemplates.Post(null, null, null, address(order.getDeliveryAddress())),
                    view.paymentMethod(), view.today(), view.trackUrl(), view.contactEmail(), view.siteUrl());
        }
        events.publishEvent(new CustomerMail(email.trim(), render(template, view)));
    }

    static Template choose(OrderNotification.Kind kind, Order order) {
        return switch (kind) {
            case WEB_PAID, SALE_CREATED, FORM_COMPLETED -> Template.CONFIRMED;
            case PAYMENT_CHANGED -> order.getPaymentState() == PaymentState.UNPAID ? null : Template.PAYMENT;
            // Post parcels get "on its way" next; a "ready" mail would only add noise.
            case ALL_FINISHED -> order.getOrderItems().stream().anyMatch(i -> i.getDeliveryKind() != DeliveryKind.POST && !i.isHandedOver())
                    ? Template.READY : null;
            case HANDED_OVER -> Template.THANKS;
            case POST_SHIPPED -> Template.SHIPPED;
            case CANCELLED -> Template.CANCELLED;
            case ADDRESS_CHANGED -> order.getDeliveryAddress() == null ? null : Template.ADDRESS;
            case FORM_SUBMITTED, PAYMENT_REVIEW -> null;
        };
    }

    static CustomerMailTemplates.Rendered render(Template template, CustomerMailTemplates.View view) {
        return switch (template) {
            case CONFIRMED -> CustomerMailTemplates.confirmed(view);
            case PAYMENT -> CustomerMailTemplates.payment(view);
            case READY -> CustomerMailTemplates.ready(view);
            case SHIPPED -> CustomerMailTemplates.shipped(view);
            case THANKS -> CustomerMailTemplates.thanks(view);
            case ADDRESS -> CustomerMailTemplates.address(view);
            case CANCELLED -> CustomerMailTemplates.cancelled(view);
        };
    }

    CustomerMailTemplates.View view(Order order) {
        boolean en = "en".equals(order.getLocale());
        ZoneId zone = ZoneId.of(props.zone());
        var calendar = new CalendarIndex(days.findAllWithMarket(), LocalDateTime.now(clock.withZone(zone)));
        String site = props.shop().publicBaseUrl() == null ? "" : props.shop().publicBaseUrl().replaceAll("/+$", "");
        List<OrderItem> items = order.getOrderItems();
        List<CustomerMailTemplates.Line> lines = items.stream().map(i -> new CustomerMailTemplates.Line(title(i, en), detail(i, en), i.getCost())).toList();

        CustomerMailTemplates.Pickup pickup = items.stream()
                .filter(i -> i.getDeliveryKind() == DeliveryKind.MARKET || i.getDeliveryKind() == DeliveryKind.DELIVERY)
                .filter(i -> !i.isHandedOver() || order.isHandedOver())
                .min(Comparator.comparing(OrderItem::getHandoffDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(i -> pickup(i, order, calendar, en)).orElse(null);

        List<OrderItem> post = order.postItems();
        CustomerMailTemplates.Post parcel = null;
        if (!post.isEmpty()) {
            LocalDate from = post.stream().map(OrderItem::getArrivalFrom).filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
            LocalDate to = post.stream().map(OrderItem::getArrivalTo).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
            String arrival = from == null || to == null ? null : AustrianPost.arrivalRange(from, to, en);
            parcel = new CustomerMailTemplates.Post(arrival, order.getTrackingNumber(), AustrianPost.trackingUrl(order.getTrackingNumber()), address(order.getDeliveryAddress()));
        }

        String method = order.getPaymentMethod() != null ? order.getPaymentMethod().name()
                : order.getSource() == OrderSource.WEB ? "STRIPE" : null;
        LocalDate today = LocalDate.now(clock.withZone(zone));
        return new CustomerMailTemplates.View(en, order.getCode(), firstName(order.getCustomer()), lines,
                post.isEmpty() ? null : order.getDeliveryFee(), nz(order.getTotal()), nz(order.getAmountPaid()), pickup, parcel, method,
                en ? today.getDayOfMonth() + " " + MONTHS_EN[today.getMonthValue() - 1] + " " + today.getYear()
                        : String.format("%02d.%02d.%d", today.getDayOfMonth(), today.getMonthValue(), today.getYear()),
                site + "/track/" + URLEncoder.encode(order.getCode(), StandardCharsets.UTF_8),
                props.mail().contactEmail(), site);
    }

    private CustomerMailTemplates.Pickup pickup(OrderItem item, Order order, CalendarIndex calendar, boolean en) {
        String when = day(item.getHandoffDate(), en);
        if (item.getDeliveryKind() == DeliveryKind.DELIVERY) {
            String window = TIME.format(props.shop().deliveryWindowStart()) + "–" + TIME.format(props.shop().deliveryWindowEnd());
            return new CustomerMailTemplates.Pickup(when + " · " + window, address(order.getDeliveryAddress()), null);
        }
        if (item.getPickUpTime() != null) when += (en ? " · from " : " · ab ") + TIME.format(item.getPickUpTime());
        Optional<MarketDay> day = calendar.pickupDay(item).filter(d -> d.getMarket().getKind() == MarketKind.MARKET);
        String market = day.map(d -> d.getMarket().getName()).orElse(en ? "Our stall" : "Unser Stand");
        Integer stall = day.map(d -> d.getMarket().getStall()).orElse(null);
        String place = market + (stall == null ? "" : (en ? ", stall " : ", Stand ") + stall);
        String maps = "https://www.google.com/maps/search/?api=1&query=" + URLEncoder.encode(market + ", Wien", StandardCharsets.UTF_8);
        return new CustomerMailTemplates.Pickup(when, place, maps);
    }

    static String day(LocalDate date, boolean en) {
        if (date == null) return "";
        int weekday = date.getDayOfWeek().getValue() - 1;
        return en ? WEEKDAYS_EN[weekday] + " " + date.getDayOfMonth() + " " + MONTHS_EN[date.getMonthValue() - 1]
                : WEEKDAYS_DE[weekday] + " " + date.getDayOfMonth() + ". " + MONTHS_DE[date.getMonthValue() - 1];
    }

    private static String title(OrderItem item, boolean en) {
        if (item.getItemKind() == ItemKind.CUSTOM) return en ? "Custom ornament" : "Personalisierte Kugel";
        String number = item.getMarketOrnamentId();
        return (en ? "Finished ornament" : "Fertige Kugel") + (number == null ? "" : " " + number);
    }

    private static String detail(OrderItem item, boolean en) {
        List<String> parts = new ArrayList<>();
        if (item.getCustomColor() != null) parts.add(color(item.getCustomColor(), en));
        if (item.getCustomFinish() != null) parts.add(item.getCustomFinish() == CustomFinish.SHINY ? (en ? "Shiny" : "Glänzend") : (en ? "Matte" : "Matt"));
        if (item.isWithName()) {
            String name = item.getNameInOrnament();
            parts.add(name == null || name.isBlank() ? (en ? "with name" : "mit Namen") : (en ? "name " : "Name ") + name);
        }
        return String.join(" · ", parts);
    }

    private static String color(CustomColor color, boolean en) {
        return switch (color) {
            case RED -> en ? "Red" : "Rot";
            case GREEN -> en ? "Green" : "Grün";
            case BEIGE -> "Beige";
            case WHITE -> en ? "White" : "Weiß";
            case GREY -> en ? "Grey" : "Grau";
        };
    }

    private static String address(Address a) {
        if (a == null) return null;
        String street = Stream.of(a.getLine1(), a.getLine2()).filter(s -> s != null && !s.isBlank()).reduce((x, y) -> x + "/" + y).orElse("");
        return street + "\n" + Stream.of(a.getPostalCode(), a.getCity()).filter(s -> s != null && !s.isBlank()).reduce((x, y) -> x + " " + y).orElse("");
    }

    /** Stall sales without a name are stored as "Walk-in": greet them without it. */
    private static String firstName(Customer customer) {
        String name = customer == null || customer.getName() == null ? "" : customer.getName().trim();
        if (name.isEmpty() || name.equalsIgnoreCase(Customer.PLACEHOLDER_NAME)) return "";
        return name.split("\\s+")[0];
    }

    private static BigDecimal nz(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
}
