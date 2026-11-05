package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.agenda.MoveSuggestionDto;
import com.artwithgab.awg_tracking.dto.agenda.TimeBlockDto;
import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.dto.order.*;
import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.repository.CustomerRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.support.CalendarRules;
import com.artwithgab.awg_tracking.support.Hours;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final OrderCodeGenerator codeGenerator;
    private final InventoryService inventoryService;
    private final PricingService pricingService;
    private final CalendarService calendarService;
    private final AgendaService agendaService;
    private final ViewMapper mapper;
    private final Clock clock;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final com.artwithgab.awg_tracking.repository.StoredPhotoRepository photoRepository;
    private final PhotoStorageService photoStorage;

    Order findOrderOrThrow(UUID id) {
        return orderRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Order not found"));
    }

    // ─── Reads ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public OrderDto getOrder(UUID id) {
        return mapper.order(findOrderOrThrow(id));
    }

    @Transactional(readOnly = true)
    public OrderDto getOrderByCode(String code) {
        return orderRepository.findByCodeIgnoreCase(code.trim())
                .map(mapper::order)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found. Check the code."));
    }

    @Transactional(readOnly = true)
    public OrderBundleDto getOrderBundle(UUID id) {
        Order order = findOrderOrThrow(id);
        CalendarIndex index = calendarService.snapshot();
        List<OrderItemDto> items = order.getOrderItems().stream().map(i -> mapper.item(i, index)).toList();
        List<TimeBlockDto> blocks = mapper.blocks(order.getOrderItems(), index);
        return new OrderBundleDto(mapper.order(order), mapper.customer(order.getCustomer()), items, blocks);
    }

    // ─── Create sale ────────────────────────────────────────────────────────

    /**
     * Creates the order at the stall. Port of createSale in the mock store plus the backend rules:
     * server-side prices, stock deduction, painting slot checks and the optional planned move of
     * another block (re-validated so a stale suggestion is rejected).
     */
    @Transactional
    public OrderDto createSale(CreateSaleRequest req) {
        calendarService.lockSchedule();
        AgendaService.Snapshot s = agendaService.snapshot();
        CalendarIndex index = s.index();

        // Planned move: recompute and require the exact same suggestion.
        MoveSuggestionDto move = req.plannedMove();
        OrderItem moving = null;
        MarketDay moveDestination = null;
        if (move != null) {
            UUID movingId = parseUuid(move.blockId());
            moving = s.items().stream().filter(i -> i.getId().equals(movingId)).findFirst().orElse(null);
            moveDestination = index.dayByDate(LocalDate.parse(move.to().date())).orElse(null);
            CreateSaleItemRequest intoSlot = req.items().stream()
                    .filter(r -> r.paintDate() != null && r.paintDate().toString().equals(move.freedSlot().date())
                            && r.paintStart() != null && Math.abs(r.paintStart() - move.freedSlot().startHour()) < Hours.EPS)
                    .findFirst().orElse(null);
            MarketDay deliveryDay = intoSlot == null ? null : index.byId(intoSlot.marketDayId()).orElse(null);
            Double beforeHour = intoSlot != null && intoSlot.deliveryKind() == DeliveryKind.MARKET && deliveryDay != null
                    && deliveryDay.getDate().toString().equals(move.freedSlot().date()) ? intoSlot.pickupHour() : null;
            MoveSuggestionDto fresh = agendaService.findMoveSuggestion(s,
                    LocalDate.parse(move.from().date()),
                    move.freedSlot().endHour() - move.freedSlot().startHour(),
                    deliveryDay != null ? deliveryDay.getDate() : LocalDate.parse(move.freedSlot().date()),
                    beforeHour);
            if (moving == null || moveDestination == null || !move.equals(fresh)) {
                throw new ConflictException("Pickup or agenda changed. Recalculate the painting plan.");
            }
        }

        Customer customer = new Customer();
        customer.setName(trimOr(req.customerName(), "Walk-in"));
        customer.setPhone(trimOr(req.phone(), ""));
        customer.setEmail(trimOr(req.email(), ""));
        customerRepository.save(customer);

        Order order = new Order();
        order.setCode(codeGenerator.generateCode());
        order.setFormToken(codeGenerator.generateFormToken());
        order.setCustomer(customer);
        order.setPaymentState(PaymentState.UNPAID);
        order.setCreatedAt(clock.instant());

        MarketDay soldOn = index.marketDayOn(index.today()).orElse(null);
        List<double[]> newBlocks = new ArrayList<>();
        List<LocalDate> newBlockDates = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        int position = 0;

        for (CreateSaleItemRequest row : req.items()) {
            OrderItem item = new OrderItem();
            boolean custom = row.kind() == ItemKind.CUSTOM;
            boolean withName = custom && row.withName();
            item.setItemKind(row.kind());
            item.setWithName(withName);
            item.setCustomColor(custom ? (row.color() == null ? CustomColor.RED : row.color()) : null);
            item.setCost(pricingService.itemCost(row.kind(), withName));
            item.setProductionStatus(custom ? ProductionStatus.NOT_STARTED : ProductionStatus.FINISHED);
            item.setSoldOnDay(soldOn);
            item.setPosition(position++);

            // Handoff
            item.setDeliveryKind(row.deliveryKind());
            MarketDay handoffDay = index.byId(row.marketDayId()).orElse(null);
            LocalDate handoff;
            if (handoffDay != null) {
                if (row.deliveryKind() == DeliveryKind.MARKET && handoffDay.getMarket().getKind() != MarketKind.MARKET) {
                    throw new BadRequestException("Choose a market day for the pickup");
                }
                handoff = handoffDay.getDate();
            } else if (!custom && row.deliveryKind() == DeliveryKind.MARKET) {
                handoff = index.today(); // finished ornament handed over on the spot
            } else {
                throw new BadRequestException(row.deliveryKind() == DeliveryKind.MARKET ? "Choose a pickup day" : "Choose a delivery day");
            }
            if (row.deliveryKind() == DeliveryKind.DELIVERY && !CalendarRules.isViennaDay(handoff)) {
                throw new BadRequestException("Vienna deliveries are on Wednesday or Friday");
            }
            if (handoff.isBefore(index.today())) throw new BadRequestException("That pickup day has already passed");
            item.setHandoffDate(handoff);
            Double pickupHour = row.deliveryKind() == DeliveryKind.MARKET && row.pickupHour() != null ? Hours.snap(row.pickupHour()) : null;
            if (pickupHour != null && handoffDay != null) {
                double open = Hours.of(handoffDay.getOpenTime());
                double close = Hours.of(handoffDay.getCloseTime());
                if (pickupHour < open - Hours.EPS || pickupHour >= close) throw new BadRequestException("Pickup hour is outside market hours");
            }
            item.setPickUpTime(pickupHour == null ? null : Hours.toTime(pickupHour));
            if (row.deliveryKind() == DeliveryKind.DELIVERY && row.address() != null && order.getDeliveryAddress() == null) {
                order.setDeliveryAddress(toAddress(row.address()));
            }

            // Painting
            if (custom) {
                if (row.deliveryKind() == DeliveryKind.MARKET && pickupHour == null) {
                    throw new BadRequestException("Choose a pickup hour before planning the painting time");
                }
                if (row.paintDate() == null || row.paintStart() == null || row.paintEnd() == null) {
                    throw new BadRequestException("Custom ornament needs a paint slot");
                }
                double start = Hours.snap(row.paintStart());
                double end = Hours.snap(row.paintEnd());
                MarketDay md = index.dayByDate(row.paintDate(), row.marketId()).or(() -> index.dayByDate(row.paintDate()))
                        .orElseThrow(() -> new BadRequestException("Cannot place paint block: no market day"));
                String movingId = moving == null ? null : moving.getId().toString();
                boolean clashExisting = s.busyOn(md.getDate(), movingId).stream().anyMatch(b -> Hours.overlap(start, end, b.start(), b.end()));
                boolean outside = end <= start
                        || start < Hours.of(md.getOpenTime()) - Hours.EPS
                        || end > Hours.of(md.getCloseTime()) + Hours.EPS
                        || md.getDate().isBefore(index.today())
                        || (index.isToday(md) && start < index.nowHour())
                        || (move != null && moveDestination.getId().equals(md.getId())
                            && Hours.overlap(start, end, move.to().startHour(), move.to().endHour()));
                if (outside) throw new BadRequestException("Choose a paint time before pickup, within working hours.");
                AgendaService.assertBeforeHandoff(row.deliveryKind(), handoff, pickupHour, md.getDate(), end, false);
                boolean clashNew = false;
                for (int k = 0; k < newBlocks.size(); k++) {
                    if (newBlockDates.get(k).equals(md.getDate()) && Hours.overlap(start, end, newBlocks.get(k)[0], newBlocks.get(k)[1])) clashNew = true;
                }
                if (clashExisting || clashNew) throw new ConflictException("That hour is taken · change / place on board");
                newBlocks.add(new double[]{start, end});
                newBlockDates.add(md.getDate());
                item.setPaintStart(md.getDate().atTime(Hours.toTime(start)));
                item.setPaintEnd(md.getDate().atTime(Hours.toTime(end)));
            }

            inventoryService.deductItem(item);
            total = total.add(item.getCost());
            item.setOrder(order);
            order.getOrderItems().add(item);
        }
        order.setTotal(total);

        if (moving != null) {
            LocalDate to = moveDestination.getDate();
            moving.setPaintStart(to.atTime(Hours.toTime(move.to().startHour())));
            moving.setPaintEnd(to.atTime(Hours.toTime(move.to().endHour())));
        }
        orderRepository.save(order);
        events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.SALE_CREATED));
        return mapper.order(order);
    }

    // ─── Updates ────────────────────────────────────────────────────────────

    @Transactional
    public OrderDto updatePaymentState(UUID orderId, PaymentState state, PaymentMethod method, BigDecimal amountPaid) {
        Order order = findOrderOrThrow(orderId);
        if (order.isAwaitingPayment()) throw new ConflictException("This web order is waiting for its online payment.");
        BigDecimal total = order.getTotal();
        BigDecimal received = switch (state) {
            case UNPAID -> BigDecimal.ZERO;
            case PAID -> total;
            // 50 % by default; a customer may leave more (or less) when there is no change.
            case DEPOSIT -> amountPaid == null ? total.divide(BigDecimal.TWO, 2, java.math.RoundingMode.HALF_UP)
                    : amountPaid.setScale(2, java.math.RoundingMode.HALF_UP);
        };
        if (state == PaymentState.DEPOSIT && (received.signum() <= 0 || received.compareTo(total) >= 0)) {
            throw new BadRequestException("A deposit must be more than 0 and less than the total.");
        }
        boolean changed = order.getPaymentState() != state || order.getAmountPaid().compareTo(received) != 0;
        order.setPaymentState(state);
        order.setAmountPaid(received);
        if (state == PaymentState.UNPAID) order.setPaymentMethod(null);
        else if (method != null) order.setPaymentMethod(method);
        if (changed) events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.PAYMENT_CHANGED));
        return mapper.order(order);
    }

    @Transactional
    public void setHandedOver(UUID orderId, boolean handedOver) {
        Order order = findOrderOrThrow(orderId);
        if (handedOver && order.getOrderItems().stream().anyMatch(i -> i.getProductionStatus() != ProductionStatus.FINISHED)) {
            throw new ConflictException("Finish all ornaments before marking handed over");
        }
        boolean changed = order.isHandedOver() != handedOver;
        order.setHandedOver(handedOver);
        if (changed && handedOver) events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.HANDED_OVER));
    }

    /** Changes one item's production status; un-finishing an item also undoes the handoff. */
    @Transactional
    public void setItemStatus(UUID orderId, UUID itemId, ProductionStatus status) {
        Order order = findOrderOrThrow(orderId);
        OrderItem item = order.getOrderItems().stream().filter(i -> i.getId().equals(itemId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));
        boolean wasFinished = item.getProductionStatus() == ProductionStatus.FINISHED;
        item.setProductionStatus(status);
        if (!wasFinished && status == ProductionStatus.FINISHED && order.getOrderItems().stream().allMatch(i -> i.getProductionStatus() == ProductionStatus.FINISHED)) {
            events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.ALL_FINISHED));
        }
        if (order.isHandedOver() && order.getOrderItems().stream().anyMatch(i -> i.getProductionStatus() != ProductionStatus.FINISHED)) {
            order.setHandedOver(false);
        }
    }

    /**
     * Staff cancellation: deletes the order, returns its stock and frees its painting time.
     * Card refunds for paid web orders are done by hand in Stripe.
     */
    @Transactional
    public void cancelOrder(UUID orderId) {
        calendarService.lockSchedule();
        Order order = findOrderOrThrow(orderId);
        if (order.isHandedOver()) throw new ConflictException("This order was already handed over.");
        events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.CANCELLED));
        deleteAndRestock(order);
    }

    /** Deletes an order with its photos, puts its ornaments back in stock and drops an orphan customer. */
    void deleteAndRestock(Order order) {
        for (OrderItem item : order.getOrderItems()) {
            if (item.getInventory() != null) item.getInventory().setQuantity(item.getInventory().getQuantity() + 1);
            Set<UUID> ids = new HashSet<>();
            item.getPhotos().forEach(p -> ids.add(p.getPhotoId()));
            if (!ids.isEmpty()) photoRepository.findByIdIn(ids).forEach(photoStorage::delete);
        }
        Customer customer = order.getCustomer();
        orderRepository.delete(order);
        orderRepository.flush();
        if (customer != null && !orderRepository.existsByCustomerId(customer.getId())) customerRepository.delete(customer);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    static Address toAddress(AddressDto dto) {
        return new Address(dto.line1().trim(), dto.line2() == null || dto.line2().isBlank() ? null : dto.line2().trim(),
                dto.city().trim(), dto.postalCode().trim());
    }

    private static String trimOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException e) {
            throw new ConflictException("Pickup or agenda changed. Recalculate the painting plan.");
        }
    }
}
