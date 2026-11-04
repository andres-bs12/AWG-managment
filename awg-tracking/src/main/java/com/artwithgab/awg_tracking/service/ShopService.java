package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.dto.common.HourSpanDto;
import com.artwithgab.awg_tracking.dto.form.FormPhotoRef;
import com.artwithgab.awg_tracking.dto.shop.*;
import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.payment.StripeClient;
import com.artwithgab.awg_tracking.repository.CustomerRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.repository.StoredPhotoRepository;
import com.artwithgab.awg_tracking.support.CalendarRules;
import com.artwithgab.awg_tracking.support.Hours;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.*;

/**
 * Public web shop: Vienna home delivery only (Wednesday/Friday), paid online with Stripe Checkout.
 *
 * Flow: the customer picks ornaments → we offer only delivery days for which every custom ornament
 * can still be painted before that day → checkout reserves the painting slots and stock and creates
 * a PENDING order → Stripe webhook confirms it (paid, card) and it shows up in the agenda and the
 * delivery list like any other order → if the checkout expires, the order is deleted and slots/stock
 * are released.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopService {
    /** Vienna postal codes: 1010–1230 (districts 1–23). */
    private static final String VIENNA_POSTAL = "^1(0[1-9]|1[0-9]|2[0-3])0$";
    private static final double CUSTOM_HOURS = 1.0;
    private static final double CUSTOM_WITH_NAME_HOURS = 1.25;
    public static final int MAX_ITEMS = 10;

    private final AwgProperties props;
    private final AgendaService agendaService;
    private final CalendarService calendarService;
    private final PricingService pricingService;
    private final InventoryService inventoryService;
    private final OrderCodeGenerator codeGenerator;
    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final StoredPhotoRepository photoRepository;
    private final PhotoStorageService photoStorage;
    private final StripeClient stripe;
    private final Clock clock;

    public boolean isOpen() {
        return props.shop().enabled() && stripe.isConfigured();
    }

    public ShopConfigDto config() {
        var p = props.pricing();
        return new ShopConfigDto(isOpen(), p.custom(), p.finished(), p.nameExtra(), fee(), MAX_ITEMS);
    }

    // ─── Delivery days ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DeliveryDateDto> deliveryDates(List<ShopItemShape> items) {
        AgendaService.Snapshot s = agendaService.snapshot();
        List<Double> durations = durations(items);
        List<DeliveryDateDto> out = new ArrayList<>();
        LocalDate first = s.index().today().plusDays(Math.max(1, props.shop().leadDays()));
        LocalDate last = s.index().today().plusDays(props.shop().maxDaysAhead());
        for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
            if (!CalendarRules.isViennaDay(d) || s.index().dayByDate(d).isEmpty()) continue;
            if (plan(s, d, durations) != null) {
                out.add(new DeliveryDateDto(d.toString(), d.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH).toLowerCase(Locale.ROOT)));
            }
        }
        return out;
    }

    /**
     * Finds a painting slot for every custom ornament, on days strictly before the delivery day and
     * not before tomorrow. Returns null when they do not all fit.
     */
    List<HourSpanDto> plan(AgendaService.Snapshot s, LocalDate delivery, List<Double> durations) {
        LocalDate notBefore = s.index().today().plusDays(1);
        Map<LocalDate, List<AgendaService.Busy>> taken = new HashMap<>();
        List<HourSpanDto> slots = new ArrayList<>();
        for (double duration : durations) {
            HourSpanDto found = null;
            for (LocalDate date : CalendarRules.paintDatesToTry(delivery, notBefore)) {
                if (!date.isBefore(delivery)) continue;
                var result = agendaService.findFreeSlot(s, date, duration, null, null,
                        taken.getOrDefault(date, List.of()), null, null);
                if (result.ok() && result.slot() != null) {
                    found = result.slot();
                    taken.computeIfAbsent(date, k -> new ArrayList<>())
                            .add(new AgendaService.Busy("new", found.startHour(), found.endHour()));
                    break;
                }
            }
            if (found == null) return null;
            slots.add(found);
        }
        return slots;
    }

    private static List<Double> durations(List<? extends Object> items) {
        List<Double> out = new ArrayList<>();
        for (Object o : items) {
            ItemKind kind = o instanceof ShopItemShape sh ? sh.kind() : ((ShopItemRequest) o).kind();
            boolean withName = o instanceof ShopItemShape sh ? sh.withName() : ((ShopItemRequest) o).withName();
            if (kind == ItemKind.CUSTOM) out.add(withName ? CUSTOM_WITH_NAME_HOURS : CUSTOM_HOURS);
        }
        // Longest first so the hardest ornaments get the earliest free time.
        out.sort(Comparator.reverseOrder());
        return out;
    }

    // ─── Checkout ───────────────────────────────────────────────────────────

    @Transactional
    public CheckoutResponse checkout(CheckoutRequest req, Map<String, MultipartFile> files) {
        if (!isOpen()) throw new StripeClient.ShopUnavailableException();
        String postal = req.address().postalCode().trim();
        if (!postal.matches(VIENNA_POSTAL)) throw new BadRequestException("We only deliver inside Vienna (postal codes 1010–1230).");
        if (!CalendarRules.isViennaDay(req.deliveryDate())) throw new BadRequestException("Deliveries are on Wednesday or Friday.");

        calendarService.lockSchedule();
        AgendaService.Snapshot s = agendaService.snapshot();
        LocalDate today = s.index().today();
        if (req.deliveryDate().isBefore(today.plusDays(Math.max(1, props.shop().leadDays())))
                || req.deliveryDate().isAfter(today.plusDays(props.shop().maxDaysAhead()))
                || s.index().dayByDate(req.deliveryDate()).isEmpty()) {
            throw new BadRequestException("Choose one of the offered delivery days.");
        }

        // Validate items before reserving anything.
        for (ShopItemRequest item : req.items()) {
            if (item.kind() == ItemKind.CUSTOM) {
                if (item.petName() == null || item.petName().isBlank()) throw new BadRequestException("Add your pet's name for each custom ornament.");
                if (item.photos() == null || item.photos().isEmpty()) throw new BadRequestException("Add at least one photo for " + item.petName().trim() + ".");
                for (FormPhotoRef ref : item.photos()) {
                    if (!files.containsKey("photo-" + ref.id())) throw new BadRequestException("A photo could not be uploaded. Add it again.");
                }
            }
        }

        // Re-plan under the lock: someone may have taken the time since the dates were listed.
        List<ShopItemRequest> customs = req.items().stream().filter(i -> i.kind() == ItemKind.CUSTOM)
                .sorted(Comparator.comparing((ShopItemRequest i) -> i.withName() ? 0 : 1)).toList();
        List<HourSpanDto> slots = plan(s, req.deliveryDate(), durations(customs));
        if (slots == null) throw new ConflictException("That delivery day just filled up. Choose another day.");

        Customer customer = new Customer();
        customer.setName(req.customerName().trim());
        customer.setEmail(req.email().trim());
        customer.setPhone(req.phone().trim());
        customerRepository.save(customer);

        Instant now = clock.instant();
        Order order = new Order();
        order.setCode(codeGenerator.generateCode());
        order.setFormToken(codeGenerator.generateFormToken());
        order.setCustomer(customer);
        order.setCreatedAt(now);
        order.setSource(OrderSource.WEB);
        order.setCheckoutStatus(CheckoutStatus.PENDING);
        order.setCheckoutExpiresAt(now.plusSeconds(60L * Math.max(30, props.shop().checkoutMinutes())));
        order.setPaymentState(PaymentState.UNPAID);
        order.setFormSubmitted(true);
        order.setDeliveryAddress(OrderService.toAddress(req.address()));
        order.setDeliveryFee(fee());

        BigDecimal total = fee();
        int position = 0;
        int slotIndex = 0;
        Map<OrderItem, ShopItemRequest> sources = new LinkedHashMap<>();
        for (ShopItemRequest row : customsFirst(req.items(), customs)) {
            OrderItem item = new OrderItem();
            boolean custom = row.kind() == ItemKind.CUSTOM;
            boolean withName = custom && row.withName();
            item.setItemKind(row.kind());
            item.setWithName(withName);
            item.setCustomColor(custom ? (row.color() == null ? CustomColor.RED : row.color()) : null);
            item.setCost(pricingService.itemCost(row.kind(), withName));
            item.setProductionStatus(custom ? ProductionStatus.NOT_STARTED : ProductionStatus.FINISHED);
            item.setPosition(position++);
            item.setDeliveryKind(DeliveryKind.DELIVERY);
            item.setHandoffDate(req.deliveryDate());
            item.setPetName(row.petName() == null ? "" : row.petName().trim());
            item.setNote(row.note() == null ? "" : row.note().trim());
            if (withName && row.backName() != null) {
                String back = row.backName().trim().toUpperCase(Locale.ROOT);
                item.setNameInOrnament(back.length() > 6 ? back.substring(0, 6) : back);
            }
            if (custom) {
                HourSpanDto slot = slots.get(slotIndex++);
                LocalDate date = LocalDate.parse(slot.date());
                item.setPaintStart(date.atTime(Hours.toTime(slot.startHour())));
                item.setPaintEnd(date.atTime(Hours.toTime(slot.endHour())));
            }
            inventoryService.deductItem(item);
            total = total.add(item.getCost());
            item.setOrder(order);
            order.getOrderItems().add(item);
            sources.put(item, row);
        }
        order.setTotal(total);
        orderRepository.saveAndFlush(order);

        for (var entry : sources.entrySet()) {
            ShopItemRequest row = entry.getValue();
            if (row.photos() == null) continue;
            for (FormPhotoRef ref : row.photos()) {
                StoredPhoto stored = photoStorage.store(files.get("photo-" + ref.id()), entry.getKey().getId(), ref.name());
                entry.getKey().getPhotos().add(new PhotoRef(stored.getId(), stored.getOriginalName()));
            }
        }

        List<StripeClient.Line> lines = new ArrayList<>();
        for (OrderItem item : order.getOrderItems()) {
            String name = item.getItemKind() == ItemKind.CUSTOM
                    ? "Custom pet ornament" + (item.getPetName().isBlank() ? "" : " · " + item.getPetName()) + (item.isWithName() ? " + name" : "")
                    : "Finished ornament";
            lines.add(new StripeClient.Line(name, item.getCost(), 1));
        }
        if (fee().signum() > 0) lines.add(new StripeClient.Line("Delivery in Vienna", fee(), 1));
        StripeClient.Session session = stripe.createCheckoutSession(order.getId().toString(), order.getCode(),
                customer.getEmail(), lines, order.getCheckoutExpiresAt());
        order.setStripeSessionId(session.id());
        return new CheckoutResponse(order.getCode(), session.url());
    }

    private static List<ShopItemRequest> customsFirst(List<ShopItemRequest> all, List<ShopItemRequest> customsInPlanOrder) {
        List<ShopItemRequest> out = new ArrayList<>(customsInPlanOrder);
        all.stream().filter(i -> i.kind() != ItemKind.CUSTOM).forEach(out::add);
        return out;
    }

    // ─── Stripe webhook ─────────────────────────────────────────────────────

    /** Handles a verified Stripe event. Idempotent: replays of the same event change nothing. */
    @Transactional
    public void handleEvent(JsonNode event) {
        String type = event.path("type").asString("");
        JsonNode session = event.path("data").path("object");
        String sessionId = session.path("id").asString("");
        if (sessionId.isEmpty()) return;
        Optional<Order> found = orderRepository.findByStripeSessionId(sessionId);
        if (found.isEmpty()) {
            log.warn("Stripe event {} for unknown session {}", type, sessionId);
            return;
        }
        Order order = found.get();
        switch (type) {
            case "checkout.session.completed", "checkout.session.async_payment_succeeded" -> {
                if (!"paid".equals(session.path("payment_status").asString(""))) return;
                long expectedCents = order.getTotal().movePointRight(2).longValueExact();
                if (session.path("amount_total").asLong(-1) != expectedCents || !"eur".equalsIgnoreCase(session.path("currency").asString(""))) {
                    log.error("Stripe amount mismatch for order {}: got {} {}", order.getCode(),
                            session.path("amount_total").asLong(-1), session.path("currency").asString(""));
                    return;
                }
                order.setCheckoutStatus(CheckoutStatus.CONFIRMED);
                order.setPaymentState(PaymentState.PAID);
                order.setPaymentMethod(PaymentMethod.CARD);
                log.info("Web order {} paid", order.getCode());
            }
            case "checkout.session.expired" -> {
                if (order.getCheckoutStatus() == CheckoutStatus.PENDING) release(order);
            }
            default -> {
                // Other events are not used.
            }
        }
    }

    /** Safety net in case the "expired" webhook never arrives. */
    @Scheduled(fixedDelayString = "PT5M")
    @Transactional
    public void releaseExpired() {
        Instant cutoff = clock.instant().minusSeconds(600);
        for (Order order : orderRepository.findByCheckoutStatusAndCheckoutExpiresAtBefore(CheckoutStatus.PENDING, cutoff)) {
            release(order);
        }
    }

    /** Deletes an unpaid web order and gives back its stock, slots and photos. */
    void release(Order order) {
        for (OrderItem item : order.getOrderItems()) {
            if (item.getInventory() != null) item.getInventory().setQuantity(item.getInventory().getQuantity() + 1);
            Set<UUID> ids = new HashSet<>();
            item.getPhotos().forEach(p -> ids.add(p.getPhotoId()));
            if (!ids.isEmpty()) photoRepository.findByIdIn(ids).forEach(photoStorage::delete);
        }
        Customer customer = order.getCustomer();
        orderRepository.delete(order);
        customerRepository.delete(customer);
        log.info("Released unpaid web order {}", order.getCode());
    }

    private BigDecimal fee() {
        BigDecimal fee = props.shop().deliveryFee();
        return fee == null ? BigDecimal.ZERO : fee.setScale(2, java.math.RoundingMode.HALF_UP);
    }
}
