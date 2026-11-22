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
import com.artwithgab.awg_tracking.support.AustrianPost;
import com.artwithgab.awg_tracking.support.PostShipping;
import com.artwithgab.awg_tracking.support.Hours;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@lombok.extern.slf4j.Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final OrderCodeGenerator codeGenerator;
    private final InventoryService inventoryService;
    private final MarketStockService marketStockService;
    private final PricingService pricingService;
    private final ShippingService shippingService;
    private final CalendarService calendarService;
    private final AgendaService agendaService;
    private final ViewMapper mapper;
    private final Clock clock;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final com.artwithgab.awg_tracking.repository.StoredPhotoRepository photoRepository;
    private final PhotoStorageService photoStorage;
    private final com.artwithgab.awg_tracking.payment.StripeClient stripe;

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
                .orElseThrow(() -> new ResourceNotFoundException("Order not found. Check the code.").code("ORDER_NOT_FOUND"));
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
    /** Result of a staff sale: created=false when the Idempotency-Key was already used. */
    public record SaleResult(OrderDto order, boolean created) {
    }

    @Transactional
    public OrderDto createSale(CreateSaleRequest req) {
        return createSale(req, null).order();
    }

    /**
     * Same as createSale, but a repeated idempotencyKey (double tap, retry after a lost response)
     * returns the order created the first time instead of selling twice. Checked under the schedule lock.
     */
    @Transactional
    public SaleResult createSale(CreateSaleRequest req, String idempotencyKey) {
        calendarService.lockSchedule();
        if (idempotencyKey != null) {
            Optional<Order> existing = orderRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) return new SaleResult(mapper.order(existing.get()), false);
        }
        return new SaleResult(doCreateSale(req, idempotencyKey), true);
    }

    private OrderDto doCreateSale(CreateSaleRequest req, String idempotencyKey) {
        AgendaService.Snapshot s = agendaService.snapshot();
        CalendarIndex index = s.index();

        var prices = pricingService.current();
        Set<String> marketIds = new HashSet<>();
        for (int n = 0; n < req.items().size(); n++) {
            CreateSaleItemRequest row = req.items().get(n);
            if (row.deliveryKind() == DeliveryKind.DELIVERY) {
                throw new BadRequestException("Choose Post shipping or market pickup.")
                        .code("VALIDATION").field("items[" + n + "].deliveryKind");
            }
            String marketId = row.marketOrnamentId();
            if (row.kind() == ItemKind.GENERIC) {
                if (marketId == null || marketId.isBlank()) {
                    throw new BadRequestException("Choose a numbered ornament.").code("VALIDATION").field("marketOrnamentId");
                }
                if (!marketIds.add(marketId)) {
                    throw new BadRequestException("Choose each numbered ornament only once.").code("VALIDATION").field("marketOrnamentId");
                }
            } else if (marketId != null) {
                throw new BadRequestException("Custom ornaments cannot use numbered market stock.").code("VALIDATION").field("marketOrnamentId");
            }
            if (row.kind() == ItemKind.CUSTOM && row.color() != null && !row.color().isOffered()) {
                throw new BadRequestException("This color is no longer sold.").code("VALIDATION").field("items[" + n + "].color");
            }
        }
        var postItems = req.items().stream().filter(row -> row.deliveryKind() == DeliveryKind.POST).toList();
        PostShipping.Window shippingWindow = null;
        Address shippingAddress = null;
        if (!postItems.isEmpty()) {
            boolean hasFinishedPost = postItems.stream().anyMatch(row -> row.kind() == ItemKind.GENERIC);
            boolean hasCustomPost = postItems.stream().anyMatch(row -> row.kind() == ItemKind.CUSTOM);
            if (hasFinishedPost && (!prices.finishedWithCustom() || !hasCustomPost)) {
                throw new BadRequestException("Finished ornaments can only ship with a custom Post item when enabled.")
                        .code("SHIPPING_NEEDS_CUSTOM").field("delivery");
            }
            // Only the parcel's own ornaments decide when it is ready; market pickups painted later do not delay it.
            var readyOn = postItems.stream().filter(row -> row.kind() == ItemKind.CUSTOM && row.paintDate() != null)
                    .map(CreateSaleItemRequest::paintDate).max(LocalDate::compareTo).orElse(index.today());
            shippingWindow = shippingService.calendar(prices).windowAfter(shippingService.withPaintFloor(readyOn))
                    .orElseThrow(() -> new BadRequestException("Post shipping is no longer available.")
                            .code("SHIPPING_UNAVAILABLE").field("delivery"));
            shippingAddress = shippingAddress(postItems);
        }

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
            MarketDay deliveryDay = intoSlot == null || intoSlot.deliveryKind() == DeliveryKind.POST
                    ? null : index.byId(intoSlot.marketDayId()).orElse(null);
            Double beforeHour = intoSlot != null && intoSlot.deliveryKind() == DeliveryKind.MARKET && deliveryDay != null
                    && deliveryDay.getDate().toString().equals(move.freedSlot().date()) && intoSlot.pickupHour() != null
                    ? intoSlot.pickupHour() - AgendaService.PAINT_HANDLING_HOURS : null;
            MarketDay pickup = intoSlot != null && intoSlot.deliveryKind() == DeliveryKind.MARKET ? deliveryDay : null;
            s.assertPaintingLocation(LocalDate.parse(move.freedSlot().date()), pickup);
            if (moving != null && moveDestination != null) {
                s.assertPaintingLocation(moveDestination.getDate(), s.marketPickup(moving).orElse(null));
            }
            MoveSuggestionDto fresh = agendaService.findMoveSuggestion(s,
                    LocalDate.parse(move.from().date()),
                    move.freedSlot().endHour() - move.freedSlot().startHour(),
                    intoSlot != null && intoSlot.deliveryKind() == DeliveryKind.POST ? shippingWindow.collectionDate()
                            : deliveryDay != null ? deliveryDay.getDate() : LocalDate.parse(move.freedSlot().date()),
                    beforeHour, pickup);
            if (moving == null || moveDestination == null || !move.equals(fresh)) {
                throw new ConflictException("Pickup or agenda changed. Recalculate the painting plan.");
            }
        }

        Customer customer = new Customer();
        customer.setName(trimOr(req.customerName(), Customer.PLACEHOLDER_NAME));
        customer.setPhone(trimOr(req.phone(), ""));
        customer.setEmail(trimOr(req.email(), ""));
        customerRepository.save(customer);

        Order order = new Order();
        order.setCode(codeGenerator.generateCode());
        order.setFormToken(codeGenerator.generateFormToken());
        order.setCustomer(customer);
        order.setPaymentState(PaymentState.UNPAID);
        order.setCreatedAt(clock.instant());
        // Staff created the sale themselves, so there is nothing new to review.
        order.setReviewedAt(order.getCreatedAt());
        if (shippingWindow != null) {
            order.setDeliveryAddress(shippingAddress);
            order.setDeliveryFee(prices.shippingFee());
        }

        MarketDay soldOn = saleMarketDay(index, req.soldOnMarketDayId());
        List<double[]> newBlocks = new ArrayList<>();
        List<LocalDate> newBlockDates = new ArrayList<>();
        BigDecimal total = shippingWindow == null ? BigDecimal.ZERO : prices.shippingFee();
        int position = 0;

        for (CreateSaleItemRequest row : req.items()) {
            OrderItem item = new OrderItem();
            boolean custom = row.kind() == ItemKind.CUSTOM;
            boolean withName = custom && row.withName();
            item.setItemKind(row.kind());
            item.setWithName(withName);
            item.setCustomColor(custom ? (row.color() == null ? CustomColor.RED : row.color()) : null);
            item.setCustomFinish(custom ? (row.finish() == null ? com.artwithgab.awg_tracking.enums.CustomFinish.SHINY : row.finish()) : null);
            item.setCost(pricingService.itemCost(row.kind(), withName));
            item.setNameExtra(pricingService.nameExtraFor(row.kind(), withName));
            item.setProductionStatus(custom ? ProductionStatus.NOT_STARTED : ProductionStatus.FINISHED);
            item.setSoldOnDay(soldOn);
            item.setPosition(position++);

            // Handoff
            item.setDeliveryKind(row.deliveryKind());
            boolean post = row.deliveryKind() == DeliveryKind.POST;
            MarketDay handoffDay = post ? null : index.byId(row.marketDayId()).orElse(null);
            if (!post && row.marketDayId() != null && handoffDay == null) {
                throw new BadRequestException("Choose a calendar day.").code("VALIDATION")
                        .field("items[" + (position - 1) + "].marketDayId");
            }
            LocalDate handoff;
            if (post) {
                handoff = shippingWindow.collectionDate();
                item.setArrivalFrom(shippingWindow.arrivalFrom());
                item.setArrivalTo(shippingWindow.arrivalTo());
            } else if (handoffDay != null) {
                // A finished ornament may be handed over on the spot on any day.
                if (custom && handoffDay.getMarket().getKind() != MarketKind.MARKET) {
                    throw new BadRequestException("Choose a market day for the pickup");
                }
                handoff = handoffDay.getDate();
            } else if (!custom && row.deliveryKind() == DeliveryKind.MARKET) {
                handoff = index.today(); // finished ornament handed over on the spot
                handoffDay = soldOn;
            } else {
                throw new BadRequestException("Choose a pickup day");
            }
            if (handoff.isBefore(index.today())) throw new BadRequestException("That pickup day has already passed");
            item.setHandoffDate(handoff);
            if (row.deliveryKind() == DeliveryKind.MARKET && handoffDay != null
                    && handoffDay.getMarket().getKind() == MarketKind.MARKET) {
                item.setHandoffDay(handoffDay);
            }
            Double pickupHour = row.deliveryKind() == DeliveryKind.MARKET && row.pickupHour() != null ? Hours.snap(row.pickupHour()) : null;
            if (pickupHour != null && handoffDay != null) {
                double open = Hours.of(handoffDay.getOpenTime());
                double close = Hours.of(handoffDay.getCloseTime());
                if (pickupHour < open - Hours.EPS || pickupHour >= close) throw new BadRequestException("Pickup hour is outside market hours");
                if (index.isToday(handoffDay) && pickupHour < index.nowHour() - Hours.EPS) throw new BadRequestException("That pickup hour has already passed");
            }
            item.setPickUpTime(pickupHour == null ? null : Hours.toTime(pickupHour));

            // Painting
            if (custom) {
                if (row.deliveryKind() == DeliveryKind.MARKET && pickupHour == null) {
                    throw new BadRequestException("Choose a pickup hour before planning the painting time");
                }
                if (row.paintDate() == null || row.paintStart() == null || row.paintEnd() == null) {
                    throw new BadRequestException("Custom ornament needs a paint slot");
                }
                s.assertPaintingLocation(row.paintDate(), item.getHandoffDay());
                double start = Hours.snap(row.paintStart());
                double end = Hours.snap(row.paintEnd());
                MarketDay md = index.dayByDate(row.paintDate(), row.marketId()).or(() -> index.dayByDate(row.paintDate()))
                        .orElseThrow(() -> new BadRequestException("Cannot place paint block: no market day"));
                String movingId = moving == null ? null : moving.getId().toString();
                boolean clashExisting = s.busyOn(md.getDate(), movingId).stream().anyMatch(b -> Hours.overlap(start, end, b.start(), b.end()));
                boolean outside = end <= start
                        || start < s.paintingOpenHour(md.getDate()) - Hours.EPS
                        || end > s.paintingCloseHour(md.getDate()) + Hours.EPS
                        || md.getDate().isBefore(index.today())
                        || (index.isToday(md) && start < index.nowHour())
                        || (move != null && moveDestination.getDate().equals(md.getDate())
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

            if (custom) inventoryService.deductItem(item);
            else item.setMarketOrnament(marketStockService.sell(row.marketOrnamentId()));
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
        order.setIdempotencyKey(idempotencyKey);
        orderRepository.save(order);
        events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.SALE_CREATED));
        return mapper.order(order);
    }

    private static Address shippingAddress(List<CreateSaleItemRequest> postItems) {
        Address address = null;
        for (var item : postItems) {
            if (item.address() == null) continue;
            AustrianPost.requireAddress(item.address());
            Address candidate = toAddress(item.address());
            if (address != null && !address.equals(candidate)) {
                throw new BadRequestException("Use one shipping address per order.").code("VALIDATION").field("address");
            }
            address = candidate;
        }
        // Custom-only parcels can get their address from the customer QR form.
        if (address == null && postItems.stream().anyMatch(item -> item.kind() == ItemKind.GENERIC)) {
            AustrianPost.requireAddress(null);
        }
        return address;
    }

    private static MarketDay saleMarketDay(CalendarIndex index, UUID id) {
        List<MarketDay> openStalls = index.marketDaysOn(index.today());
        if (id == null && openStalls.size() <= 1) return openStalls.stream().findFirst().orElse(null);
        return openStalls.stream().filter(day -> day.getId().equals(id)).findFirst()
                .orElseThrow(() -> new BadRequestException("Choose the market where this sale took place.")
                        .code("VALIDATION").field("soldOnMarketDayId"));
    }

    // ─── Updates ────────────────────────────────────────────────────────────

    @Transactional
    public OrderDto updatePaymentState(UUID orderId, PaymentState state, PaymentMethod method, BigDecimal amountPaid) {
        Order order = findOrderOrThrow(orderId);
        requireActive(order);
        if (order.isAwaitingPayment()) throw new ConflictException("This web order is waiting for its online payment.").code("PAYMENT_PENDING");
        // Staff checked a mismatched Stripe payment by hand: recording a payment (paid or deposit) resolves the review.
        if (order.isPaymentReview()) {
            if (state == PaymentState.UNPAID) {
                throw new ConflictException("Check this payment in Stripe first, then record it as paid or deposit.").code("PAYMENT_PENDING");
            }
            order.setCheckoutStatus(com.artwithgab.awg_tracking.enums.CheckoutStatus.CONFIRMED);
        }
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
    public void setHandedOver(UUID orderId, boolean handedOver, List<UUID> itemIds) {
        setHandedOver(orderId, handedOver, itemIds, null);
    }

    @Transactional
    public void setHandedOver(UUID orderId, boolean handedOver, List<UUID> itemIds, String trackingNumber) {
        Order order = orderRepository.findForHandover(orderId).orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        requireActive(order);
        var items = order.getOrderItems();
        var selected = itemIds == null ? items : items.stream().filter(i -> itemIds.contains(i.getId())).toList();
        if (itemIds != null && (itemIds.isEmpty() || selected.size() != new java.util.HashSet<>(itemIds).size() || selected.size() != itemIds.size())) {
            throw new BadRequestException("Select valid items from this order.");
        }
        if (handedOver && selected.stream().anyMatch(i -> i.getProductionStatus() != ProductionStatus.FINISHED)) {
            throw new ConflictException("Finish all ornaments before marking handed over");
        }
        if (trackingNumber != null) {
            if (items.stream().noneMatch(i -> i.getDeliveryKind() == DeliveryKind.POST)) {
                throw new BadRequestException("This order has no Post shipment.").code("VALIDATION").field("trackingNumber");
            }
            if (order.getAnonymizedAt() != null) {
                throw new ConflictException("The shipment details have expired.").field("trackingNumber");
            }
            order.setTrackingNumber(AustrianPost.trackingNumber(trackingNumber));
        }
        boolean alreadyShipped = order.isPostShipped();
        selected.forEach(i -> i.setHandedOver(handedOver));
        boolean completed = updateHandover(order);
        if (!alreadyShipped && order.isPostShipped()) {
            events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.POST_SHIPPED));
        } else if (completed) {
            events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.HANDED_OVER));
        }
    }

    private boolean updateHandover(Order order) {
        boolean complete = !order.getOrderItems().isEmpty() && order.getOrderItems().stream().allMatch(OrderItem::isHandedOver);
        boolean changed = order.isHandedOver() != complete;
        order.setHandedOver(complete);
        if (changed) order.setHandedOverAt(complete ? clock.instant() : null);
        return changed && complete;
    }

    /** Changes one item's production status; un-finishing an item also undoes the handoff. */
    @Transactional
    public void setItemStatus(UUID orderId, UUID itemId, ProductionStatus status) {
        calendarService.lockSchedule();
        Order order = orderRepository.findForHandover(orderId).orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        requireActive(order);
        OrderItem item = order.getOrderItems().stream().filter(i -> i.getId().equals(itemId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));
        boolean wasFinished = item.getProductionStatus() == ProductionStatus.FINISHED;
        if (!wasFinished && status == ProductionStatus.FINISHED) shortenFinishedSession(item);
        if (wasFinished && status != ProductionStatus.FINISHED && item.getPaintStart() != null && !order.isUnconfirmedWeb()) {
            AgendaService.Snapshot schedule = agendaService.snapshot();
            LocalDate date = item.getPaintStart().toLocalDate();
            double start = Math.max(Hours.of(item.getPaintStart().toLocalTime()), schedule.paintElapsedUntil(date));
            double end = Hours.of(item.getPaintEnd().toLocalTime());
            if (start < end && schedule.busyOn(date, itemId.toString()).stream().anyMatch(b -> Hours.overlap(start, end, b.start(), b.end()))) {
                throw new ConflictException("Another session has booked this painting time.");
            }
        }
        item.setProductionStatus(status);
        if (!wasFinished && status == ProductionStatus.FINISHED && order.getOrderItems().stream().allMatch(i -> i.getProductionStatus() == ProductionStatus.FINISHED)) {
            events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.ALL_FINISHED));
        }
        if (status != ProductionStatus.FINISHED && item.isHandedOver()) {
            item.setHandedOver(false);
            updateHandover(order);
        }
    }

    private void shortenFinishedSession(OrderItem item) {
        LocalDateTime start = item.getPaintStart();
        LocalDateTime end = item.getPaintEnd();
        LocalDateTime now = LocalDateTime.now(clock);
        if (start == null || end == null || !now.toLocalDate().equals(start.toLocalDate()) || !now.isBefore(end)) return;

        LocalDateTime midnight = start.toLocalDate().atStartOfDay();
        LocalDateTime quarter = now.truncatedTo(ChronoUnit.HOURS).plusMinutes(now.getMinute() / 15 * 15L);
        LocalDateTime recordedEnd = now.equals(quarter) && !quarter.equals(midnight) ? quarter : quarter.plusMinutes(15);
        if (!recordedEnd.isBefore(end)) return;
        if (now.isBefore(start) || !recordedEnd.isAfter(start)) item.setPaintStart(recordedEnd.minusMinutes(15));
        item.setPaintEnd(recordedEnd);
    }

    /**
     * Staff cancellation: retains the order, returns eligible stock and frees its painting time.
     * Card refunds for paid web orders are done by hand in Stripe.
     */
    @Transactional
    public void cancelOrder(UUID orderId) { cancelOrder(orderId, null); }

    @Transactional
    public void cancelOrder(UUID orderId, String reason) {
        calendarService.lockSchedule();
        Order order = orderRepository.findForHandover(orderId).orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (order.isCancelled()) return;
        if (reason != null && reason.length() > 500) throw new BadRequestException("Reason must be 500 characters or fewer.").code("VALIDATION").field("reason");
        if (order.isHandedOver() || order.getOrderItems().stream().anyMatch(OrderItem::isHandedOver)) throw new ConflictException("This order contains handed-over items.");
        if (order.isAwaitingPayment() && order.getStripeSessionId() != null) {
            // Close the Stripe page first so the customer cannot pay a cancelled order.
            if (stripe.expireOrReconcile(order.getStripeSessionId()).equals("complete")) {
                throw new ConflictException("The customer just paid this order online. Refresh before cancelling.")
                        .code("PAYMENT_PENDING");
            }
        } else if (order.getStripeSessionId() != null) {
            log.warn("Cancelled web order {} (Stripe session {}): refund it in Stripe if it was paid",
                    order.getCode(), order.getStripeSessionId());
        }
        events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.CANCELLED));
        for (OrderItem item : order.getOrderItems()) {
            if (item.getMarketOrnamentId() != null) marketStockService.returnSold(item.getMarketOrnamentId());
            boolean resellable = item.getItemKind() == ItemKind.GENERIC || item.getProductionStatus() == ProductionStatus.NOT_STARTED;
            if (item.getInventory() != null && resellable) item.getInventory().setQuantity(item.getInventory().getQuantity() + 1);
        }
        order.setStatus("CANCELLED");
        order.setCancelledAt(clock.instant());
        order.setCancellationReason(reason == null || reason.isBlank() ? null : reason.trim());
    }

    private static void requireActive(Order order) {
        if (order.isCancelled()) throw new ConflictException("This order is cancelled.");
    }

    /** Deletes an order with its photos, puts unpainted ornaments back in stock and drops an orphan customer. */
    void deleteAndRestock(Order order) {
        for (OrderItem item : order.getOrderItems()) {
            // A blank whose painting started (or finished) cannot go back on the shelf; finished
            // ready-made ornaments and untouched blanks can.
            boolean resellable = item.getItemKind() == ItemKind.GENERIC || item.getProductionStatus() == ProductionStatus.NOT_STARTED;
            if (item.getInventory() != null && resellable) item.getInventory().setQuantity(item.getInventory().getQuantity() + 1);
            Set<UUID> ids = new HashSet<>();
            item.getPhotos().forEach(p -> ids.add(p.getPhotoId()));
            if (!ids.isEmpty()) photoRepository.findByIdIn(ids).forEach(photoStorage::delete);
        }
        Customer customer = order.getCustomer();
        orderRepository.delete(order);
        orderRepository.flush();
        if (customer != null && !orderRepository.existsByCustomerId(customer.getId())) customerRepository.delete(customer);
    }

    /**
     * Staff search: a code fragment, a customer name or phone digits. Short queries return nothing
     * so a single letter does not list every customer.
     */
    @Transactional(readOnly = true)
    public List<OrderSummaryDto> search(String query) {
        String q = query == null ? "" : query.trim();
        if (q.length() < 2) return List.of();
        // PostgreSQL rejects NUL bytes in text parameters; such a query can never match anyway.
        if (q.length() > 100 || q.indexOf('\0') >= 0) throw new BadRequestException("Search must contain at most 100 characters.").code("VALIDATION").field("query");
        String digits = q.replaceAll("\\D", "");
        // Without at least 3 digits the phone clause must not match everything. The sentinel holds no
        // digit, so it never occurs in a stripped phone number; PostgreSQL rejects NUL bytes in text.
        String phone = digits.length() >= 3 ? digits : "~no-phone~";
        return orderRepository.search(q, phone, org.springframework.data.domain.PageRequest.of(0, 20)).stream().map(OrderService::summary).toList();
    }

    /** Staff sales use Vienna calendar dates and bounded, deterministic database pagination. */
    @Transactional(readOnly = true)
    public SalesPageDto listSales(String state, String source, LocalDate from, LocalDate to, int page, int size, String query) {
        Set<String> states = Set.of("unpaid", "deposit", "paid", "pending", "review");
        if (state != null && !states.contains(state)) throw new BadRequestException("Choose a valid payment state.").code("VALIDATION").field("state");
        if (source != null && !Set.of("stall", "web").contains(source)) throw new BadRequestException("Choose a valid sale source.").code("VALIDATION").field("source");
        if (page < 0 || size < 1 || size > 50) throw new BadRequestException("Choose a valid sales page (1–50 orders).").code("VALIDATION").field("page");
        if (from != null && to != null && from.isAfter(to)) throw new BadRequestException("From must be on or before To.").code("VALIDATION").field("from");
        String q = query == null ? "" : query.trim();
        if (q.length() > 100 || q.indexOf('\0') >= 0) throw new BadRequestException("Search must contain at most 100 characters.").code("VALIDATION").field("query");
        org.springframework.data.jpa.domain.Specification<Order> filters = (root, criteria, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            // Retention erases personal data; erased orders are not returned by staff search.
            predicates.add(cb.isNull(root.get("anonymizedAt")));
            if ("pending".equals(state) || "review".equals(state)) {
                predicates.add(cb.equal(root.get("checkoutStatus"), CheckoutStatus.valueOf(state.toUpperCase(Locale.ROOT))));
            } else if (state != null) {
                predicates.add(cb.equal(root.get("paymentState"), PaymentState.valueOf(state.toUpperCase(Locale.ROOT))));
                // Pending/review is the displayed payment state, rather than "unpaid".
                predicates.add(cb.or(cb.isNull(root.get("checkoutStatus")), cb.equal(root.get("checkoutStatus"), CheckoutStatus.CONFIRMED)));
            }
            if ("web".equals(source)) predicates.add(cb.equal(root.get("source"), OrderSource.WEB));
            if ("stall".equals(source)) predicates.add(cb.or(cb.isNull(root.get("source")), cb.equal(root.get("source"), OrderSource.STALL)));
            var vienna = java.time.ZoneId.of("Europe/Vienna");
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay(vienna).toInstant()));
            if (to != null) predicates.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay(vienna).toInstant()));
            if (!q.isEmpty()) {
                if (q.length() < 2) return cb.disjunction();
                String pattern = "%" + q.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                var customer = root.join("customer");
                var code = cb.like(cb.lower(root.get("code")), pattern, '\\');
                var name = cb.like(cb.lower(customer.get("name")), pattern, '\\');
                String digits = q.replaceAll("\\D", "");
                jakarta.persistence.criteria.Expression<String> phone = customer.get("phone");
                for (String mark : List.of(" ", "-", "/", "(", ")", "+", ".")) phone = cb.function("replace", String.class, phone, cb.literal(mark), cb.literal(""));
                predicates.add(digits.length() >= 3 ? cb.or(code, name, cb.like(phone, "%" + digits + "%")) : cb.or(code, name));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var result = orderRepository.findAll(filters, org.springframework.data.domain.PageRequest.of(page, size,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt", "id")));
        return new SalesPageDto(result.getContent().stream().map(order -> summary(order, true)).toList(),
                page, size, result.getTotalElements(), result.getTotalPages());
    }

    /** Web orders staff must look at: new paid orders to review, still waiting for Stripe, or paid with a mismatching amount. */
    @Transactional(readOnly = true)
    public List<OrderSummaryDto> needingAttention() {
        return java.util.stream.Stream.concat(orderRepository.findUnreviewedWebOrders().stream(),
                        orderRepository.findByCheckoutStatusIn(List.of(CheckoutStatus.PENDING, CheckoutStatus.REVIEW)).stream())
                .map(OrderService::summary).toList();
    }

    /** Staff confirms they saw a new web order; repeating it keeps the first time. */
    @Transactional
    public OrderDto markReviewed(UUID orderId) {
        Order order = orderRepository.findById(orderId).orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        if (order.getReviewedAt() == null) order.setReviewedAt(clock.instant());
        return getOrder(orderId);
    }

    static OrderSummaryDto summary(Order o) {
        return summary(o, false);
    }

    private static OrderSummaryDto summary(Order o, boolean includeSaleItems) {
        String next = o.getOrderItems().stream().map(OrderItem::getHandoffDate).filter(Objects::nonNull)
                .min(Comparator.naturalOrder()).map(Object::toString).orElse(null);
        boolean web = o.getSource() == OrderSource.WEB;
        String soldAtMarketName = web ? null : o.getOrderItems().stream().map(OrderItem::getSoldOnDay)
                .filter(Objects::nonNull).map(day -> day.getMarket().getName()).findFirst().orElse(null);
        List<OrderSummaryDto.SaleItem> saleItems = includeSaleItems ? o.getOrderItems().stream().map(item ->
                new OrderSummaryDto.SaleItem(item.getId().toString(), item.getItemKind(), item.getCustomColor(),
                        item.getPhotos().isEmpty() ? null : ViewMapper.photoUrl(item.getPhotos().getFirst()),
                        item.getMarketOrnamentId())).toList() : List.of();
        return new OrderSummaryDto(o.getId().toString(), o.getCode(), o.getCustomer() == null ? "" : o.getCustomer().getName(),
                o.getCustomer() == null ? "" : o.getCustomer().getPhone(), o.getCreatedAt() == null ? null : o.getCreatedAt().toString(),
                o.getPaymentState().name().toLowerCase(Locale.ROOT), o.getCheckoutStatus() == null ? null : o.getCheckoutStatus().name().toLowerCase(Locale.ROOT),
                o.getTotal(), o.getOrderItems().size(), next, o.isHandedOver(),
                web ? "web" : "stall", o.getStatus(),
                o.getAmountPaid() == null ? BigDecimal.ZERO : o.getAmountPaid(), soldAtMarketName, saleItems, o.needsReview());
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
