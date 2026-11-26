package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.agenda.*;
import com.artwithgab.awg_tracking.dto.common.HourSpanDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.MakeRoomReplay;
import com.artwithgab.awg_tracking.model.Market;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.MakeRoomReplayRepository;
import com.artwithgab.awg_tracking.repository.OrderItemRepository;
import com.artwithgab.awg_tracking.support.CalendarRules;
import com.artwithgab.awg_tracking.support.Hours;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Painting agenda and deliveries. Port of the agenda part of frontend/src/api/mock/store.ts;
 * error messages are kept identical because the UI matches on some of them.
 */
@Service
@RequiredArgsConstructor
public class AgendaService {
    private final OrderItemRepository orderItemRepository;
    private final com.artwithgab.awg_tracking.repository.PaintingDayRepository paintingDayRepository;
    private final com.artwithgab.awg_tracking.config.AwgProperties props;
    private final CalendarService calendarService;
    private final ViewMapper mapper;
    private final MakeRoomReplayRepository makeRoomReplays;
    private final ObjectMapper objectMapper;

    static final String PAINT_NOT_AT_THIS_MARKET = "PAINT_NOT_AT_THIS_MARKET";
    /** Handling buffer required between paint end and a same-day market pickup (15 minutes). */
    static final double PAINT_HANDLING_HOURS = 0.25;

    /** A busy painting range on one date. */
    record Busy(String id, double start, double end) {
    }

    /** Maximum paintings a day can take: one ~60-minute block per full painting hour (10–13 → 3, 10–12 → 2). */
    static int maxPaintingsFromHours(double openHour, double closeHour) {
        return Math.max(0, (int) Math.floor((closeHour - openHour) + Hours.EPS));
    }

    /**
     * Effective painting hours on a date:
     * 1. PaintingDay override if set;
     * 2. the hours of the market Gaby paints at on that date ("paints at" on PaintingDay), if open;
     * 3. the configured primary pickup market's day on that date, if open;
     * 4. the stall that opens earliest (tie: name);
     * 5. the home painting day on that date.
     */
    static double[] effectivePaintingHours(LocalDate date, com.artwithgab.awg_tracking.model.PaintingDay rule,
                                           List<MarketDay> stallsOnDate, Optional<MarketDay> fallbackDay,
                                           UUID primaryPickupMarketId) {
        UUID paintingMarketId = rule != null && rule.getPaintingMarket() != null ? rule.getPaintingMarket().getId() : null;
        Optional<MarketDay> day = CalendarIndex.effectivePaintingStall(stallsOnDate, paintingMarketId, primaryPickupMarketId)
                .or(() -> fallbackDay);
        double open = rule != null && rule.getOpenHour() != null
                ? rule.getOpenHour()
                : day.map(d -> Hours.of(d.getOpenTime())).orElseGet(() -> Hours.of(CalendarRules.homePaintHours(date)[0]));
        double close = rule != null && rule.getCloseHour() != null
                ? rule.getCloseHour()
                : day.map(d -> Hours.of(d.getCloseTime())).orElseGet(() -> Hours.of(CalendarRules.homePaintHours(date)[1]));
        return new double[]{open, close};
    }

    /** Data for one request: calendar plus every item. */
    record Snapshot(CalendarIndex index, List<OrderItem> items, Map<LocalDate, com.artwithgab.awg_tracking.model.PaintingDay> paintingDays,
                    int defaultMaxPaintings) {

        UUID primaryPickupMarketId() {
            return index.primaryPickupMarketId();
        }

        /** Active bookings, including pending web orders. Finished sessions occupy only their recorded time. */
        int paintingsOn(LocalDate date, String ignoreId) {
            return (int) items.stream()
                    .filter(i -> i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(date))
                    .filter(i -> i.getProductionStatus() != ProductionStatus.FINISHED)
                    .filter(i -> ignoreId == null || !i.getId().toString().equals(ignoreId))
                    .count();
        }

        boolean paintingOpen(LocalDate date) {
            var rule = paintingDays.get(date);
            return rule == null || rule.isOpen();
        }

        Market paintingMarket(LocalDate date) {
            var rule = paintingDays.get(date);
            return rule == null ? null : rule.getPaintingMarket();
        }

        Optional<MarketDay> paintingMarketDay(LocalDate date) {
            Market paintsAt = paintingMarket(date);
            return index.paintingDayOn(date, paintsAt == null ? null : paintsAt.getId(), primaryPickupMarketId());
        }

        /** The painting market when a same-day pickup would be at a different stall. */
        Optional<Market> paintingMarketMismatch(LocalDate paintDate, MarketDay pickup) {
            if (pickup == null || !paintDate.equals(pickup.getDate())) return Optional.empty();
            return paintingMarketDay(paintDate).map(MarketDay::getMarket)
                    .filter(market -> !market.getId().equals(pickup.getMarket().getId()));
        }

        void assertPaintingLocation(LocalDate paintDate, MarketDay pickup) {
            paintingMarketMismatch(paintDate, pickup).ifPresent(market -> {
                throw new ConflictException(paintingLocationMessage(market)).code(PAINT_NOT_AT_THIS_MARKET);
            });
        }

        Optional<MarketDay> marketPickup(OrderItem item) {
            return item.getDeliveryKind() == DeliveryKind.MARKET ? index.pickupDay(item) : Optional.empty();
        }

        int maxPaintings(LocalDate date) {
            return maxPaintingsFromHours(paintingOpenHour(date), paintingCloseHour(date));
        }

        double paintingOpenHour(LocalDate date) {
            return effectivePaintingHours(date, paintingDays.get(date), index.marketDaysOn(date),
                    index.dayByDate(date), primaryPickupMarketId())[0];
        }

        double paintingCloseHour(LocalDate date) {
            return effectivePaintingHours(date, paintingDays.get(date), index.marketDaysOn(date),
                    index.dayByDate(date), primaryPickupMarketId())[1];
        }

        List<Busy> busyOn(LocalDate date, String ignoreId) {
            double elapsedUntil = paintElapsedUntil(date);
            return items.stream()
                    .filter(i -> i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(date))
                    .filter(i -> !i.getId().toString().equals(ignoreId))
                    .map(i -> {
                        double end = Hours.of(i.getPaintEnd().toLocalTime());
                        if (i.getProductionStatus() == ProductionStatus.FINISHED && !i.getOrder().isUnconfirmedWeb()) {
                            end = Math.min(end, elapsedUntil);
                        }
                        return new Busy(i.getId().toString(), Hours.of(i.getPaintStart().toLocalTime()), end);
                    })
                    .filter(b -> b.end() > b.start())
                    .sorted(Comparator.comparingDouble(Busy::start))
                    .toList();
        }

        double paintElapsedUntil(LocalDate date) {
            if (date.isBefore(index.today())) return Double.POSITIVE_INFINITY;
            if (date.isAfter(index.today())) return 0;
            // Keep the rounded quarter recorded when a session is marked Ready.
            return index.roundedQuarterHour();
        }
    }

    Snapshot snapshot() {
        Map<LocalDate, com.artwithgab.awg_tracking.model.PaintingDay> rules = new HashMap<>();
        paintingDayRepository.findAll().forEach(d -> rules.put(d.getDate(), d));
        CalendarIndex index = calendarService.snapshot().withPrimaryPickupMarket(props.shop().primaryPickupMarketId());
        return new Snapshot(index, orderItemRepository.findAllWithOrder(), rules, props.calendar().defaultMaxPaintings());
    }

    // ─── Reads ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AgendaDayDto> listDays() {
        Snapshot s = snapshot();
        return s.index().days().stream().map(MarketDay::getDate).distinct().sorted()
                .map(date -> dayView(s, date)).toList();
    }

    @Transactional(readOnly = true)
    public AgendaDayDto getDay(LocalDate date) {
        return dayView(snapshot(), date);
    }

    private AgendaDayDto dayView(Snapshot s, LocalDate date) {
        CalendarIndex index = s.index();
        MarketDay day = s.paintingMarketDay(date).or(index::todayDay)
                .orElseThrow(() -> new ResourceNotFoundException("No market day on that date."));
        List<AgendaSlotDto> slots = s.items().stream()
                .filter(i -> i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(day.getDate()))
                .sorted(Comparator.comparing(OrderItem::getPaintStart))
                .map(i -> {
                    Order order = i.getOrder();
                    if (order.isUnconfirmedWeb()) {
                        return new AgendaSlotDto(mapper.block(i, index), null, null, null, true,
                                order.getCheckoutExpiresAt() == null || order.isPaymentReview() ? null : order.getCheckoutExpiresAt().toString(), null);
                    }
                    return new AgendaSlotDto(mapper.block(i, index), mapper.order(order), mapper.item(i, index),
                            mapper.customer(order.getCustomer()), false, null, firstPhotoUrl(i));
                })
                .toList();
        List<MarketDay> stalls = index.marketDaysOn(day.getDate());
        Market paintsAt = s.paintingMarket(day.getDate());
        return new AgendaDayDto(mapper.marketDay(day, index.today()), mapper.market(day.getMarket()), slots, deliveries(s, day.getDate()),
                stalls.stream().map(d -> mapper.market(d.getMarket())).toList(),
                stalls.stream().map(d -> mapper.marketDay(d, index.today())).toList(),
                paintsAt == null ? null : paintsAt.getId().toString(), paintsAt == null ? null : paintsAt.getName());
    }

    /** Staff read the delivery day on each row, for example "Wed 2 Dec". */
    private static final java.time.format.DateTimeFormatter HANDOFF_DAY = java.time.format.DateTimeFormatter.ofPattern("EEE d MMM", java.util.Locale.ENGLISH);

    private List<AgendaDeliveryDto> deliveries(Snapshot s, LocalDate date) {
        List<AgendaDeliveryDto> rows = new ArrayList<>();
        for (OrderItem item : s.items()) {
            if (!date.equals(item.getHandoffDate())) continue;
            Order order = item.getOrder();
            if (order.isUnconfirmedWeb()) continue;
            var customer = order.getCustomer();
            String title = firstNonBlank(item.getPetName(), customer.getName(), "Ornament");
            String photoUrl = firstPhotoUrl(item);
            boolean market = item.getDeliveryKind() == DeliveryKind.MARKET;
            MarketDay pickupDay = market ? s.index().pickupDay(item).orElse(null) : null;
            Market pickupMarket = pickupDay == null ? null : pickupDay.getMarket();
            Double hour = market && item.getPickUpTime() != null ? Hours.of(item.getPickUpTime()) : null;
            rows.add(new AgendaDeliveryDto(
                    customer.getName(), item.getCustomColor(), item.getCustomFinish(), item.getOrnamentSize(), ViewMapper.nz(item.getNameInOrnament()),
                    order.getId().toString(), order.getCode(), item.getId().toString(), title,
                    item.getProductionStatus(), item.isHandedOver(), item.getDeliveryKind(), hour,
                    switch (item.getDeliveryKind()) {
                        case MARKET -> pickupMarket == null ? "Market pickup" : pickupMarket.getName();
                        case DELIVERY -> "Vienna · " + HANDOFF_DAY.format(date);
                        case POST -> "Post · " + HANDOFF_DAY.format(date);
                    },
                    pickupMarket == null ? null : pickupMarket.getId().toString(),
                    pickupMarket == null ? null : pickupMarket.getName(),
                    pickupDay == null ? null : pickupDay.getId().toString(),
                    hour == null ? null : Hours.format(hour),
                    customer.getPhone(),
                    market ? null : addressLabel(order),
                    photoUrl, order.getTotal().subtract(order.getAmountPaid()).max(java.math.BigDecimal.ZERO), order.getPaymentState(), order.getSource(),
                    item.getItemKind(),
                    market || order.getDeliveryAddress() == null ? null : ViewMapper.nz(order.getDeliveryAddress().getPostalCode()),
                    item.getItemKind() == com.artwithgab.awg_tracking.enums.ItemKind.CUSTOM && (item.getPhotos().isEmpty() || (item.isWithName() && ViewMapper.nz(item.getNameInOrnament()).isBlank())),
                    order.getTotal(), order.getAmountPaid()));
        }
        rows.sort(Comparator.<AgendaDeliveryDto>comparingInt(r -> r.deliveryKind() == DeliveryKind.MARKET ? 0 : 1)
                .thenComparingDouble(r -> r.pickupHour() == null ? 99 : r.pickupHour()));
        return rows;
    }

    private static String addressLabel(Order order) {
        var a = order.getDeliveryAddress();
        if (a == null || a.getLine1() == null || a.getLine1().isBlank()) return null;
        String street = java.util.stream.Stream.of(a.getLine1(), a.getLine2()).filter(x -> x != null && !x.isBlank()).collect(Collectors.joining(", "));
        String city = java.util.stream.Stream.of(a.getPostalCode(), a.getCity()).filter(x -> x != null && !x.isBlank()).collect(Collectors.joining(" "));
        return java.util.stream.Stream.of(street, city).filter(x -> !x.isBlank()).collect(Collectors.joining(" · "));
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v;
        return "";
    }

    private static String firstPhotoUrl(OrderItem item) {
        return item.getPhotos().isEmpty() ? null : ViewMapper.photoUrl(item.getPhotos().getFirst());
    }

    // ─── Capacity ───────────────────────────────────────────────────────────

    static void assertPaintingLocationChange(CalendarIndex index, List<OrderItem> items, LocalDate date,
                                             UUID previousMarketId, UUID nextMarketId) {
        if (Objects.equals(previousMarketId, nextMarketId)) return;
        long pickups = items.stream()
                .filter(item -> item.getItemKind() == ItemKind.CUSTOM && item.getDeliveryKind() == DeliveryKind.MARKET
                        && date.equals(item.getHandoffDate()) && item.getPaintStart() != null
                        && date.equals(item.getPaintStart().toLocalDate()))
                .flatMap(item -> index.pickupDay(item).stream())
                .filter(pickup -> !pickup.getMarket().getId().equals(nextMarketId))
                .count();
        if (pickups > 0) {
            throw new ConflictException("Changing where Gaby paints would leave " + pickups
                    + (pickups == 1 ? " same-day pickup" : " same-day pickups") + " at another market.")
                    .code(PAINT_NOT_AT_THIS_MARKET);
        }
    }

    private static String paintingLocationMessage(Market market) {
        return "Gaby is painting at " + market.getName() + " that day. Pick another day.";
    }

    @Transactional(readOnly = true)
    public CapacityResultDto checkCapacity(CapacityRequest req) {
        Snapshot s = snapshot();
        var mismatch = s.paintingMarketMismatch(req.date(), s.index().byId(req.handoffMarketDayId()).orElse(null));
        if (mismatch.isPresent()) {
            return new CapacityResultDto(false, null, 0, paintingLocationMessage(mismatch.get()));
        }
        List<Busy> extra = req.extraBusy() == null ? List.of()
                : req.extraBusy().stream().map(b -> new Busy("draft", b.startHour(), b.endHour())).toList();
        return findFreeSlot(s, req.date(), req.durationHours(), req.afterHour(), null, extra, null, req.beforeHour());
    }

    /** Port of findFreeSlot: first gap of durationHours between afterHour and beforeHour on that date. */
    CapacityResultDto findFreeSlot(Snapshot s, LocalDate date, double duration, Double afterHour, UUID marketId,
                                   List<Busy> extraBusy, String ignoreBlockId, Double beforeHour) {
        MarketDay day = s.index().dayByDate(date, marketId).or(() -> s.index().dayByDate(date)).orElse(null);
        return findFreeSlot(s, date, day, duration, afterHour, extraBusy, ignoreBlockId, beforeHour);
    }

    static CapacityResultDto findFreeSlot(Snapshot s, LocalDate date, MarketDay day, double duration, Double afterHour,
                                          List<Busy> extraBusy, String ignoreBlockId, Double beforeHour) {
        CalendarIndex index = s.index();
        // Automatic planning respects Gaby's day switch and daily limit.
        if (!s.paintingOpen(date)) return new CapacityResultDto(false, null, 0, "Painting is closed on this day.");
        if (s.paintingsOn(date, ignoreBlockId) + extraBusy.size() >= s.maxPaintings(date)) {
            return new CapacityResultDto(false, null, 0, "Daily painting limit reached.");
        }
        if (day == null) return new CapacityResultDto(false, null, 0, "No market day on that date.");
        double open = s.paintingOpenHour(date);
        double close = s.paintingCloseHour(date);
        double floor = index.isToday(day) && afterHour == null
                ? Math.max(open, index.nowHour())
                : Math.max(open, afterHour == null ? open : afterHour);
        List<Busy> busy = new ArrayList<>(s.busyOn(day.getDate(), ignoreBlockId));
        busy.addAll(extraBusy);
        busy.sort(Comparator.comparingDouble(Busy::start));
        double ceiling = Math.min(close, beforeHour == null ? close : beforeHour);

        double cursor = floor;
        for (Busy b : busy) {
            if (b.end() <= cursor) continue;
            if (b.start() - cursor >= duration - Hours.EPS) {
                CapacityResultDto placed = tryPlace(day, busy, cursor, duration, ceiling);
                if (placed != null) return placed;
            }
            cursor = Math.max(cursor, b.end());
        }
        CapacityResultDto tail = tryPlace(day, busy, cursor, duration, ceiling);
        if (tail != null) return tail;
        return new CapacityResultDto(false, null, Math.max(0, ceiling - cursor),
                "No free " + Hours.formatMinutes((int) Math.round(duration * 60)) + " slot on this day.");
    }

    private static CapacityResultDto tryPlace(MarketDay day, List<Busy> busy, double start, double duration, double ceiling) {
        double end = start + duration;
        if (end > ceiling + Hours.EPS) return null;
        if (busy.stream().anyMatch(b -> Hours.overlap(start, end, b.start(), b.end()))) return null;
        return new CapacityResultDto(true, new HourSpanDto(day.getDate().toString(), start, end), ceiling - end,
                "Suggested " + Hours.format(start) + "–" + Hours.format(end));
    }

    // ─── Move suggestion ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public MoveSuggestionDto findMoveSuggestion(MoveSuggestionRequest req) {
        Snapshot s = snapshot();
        return findMoveSuggestion(s, req.date(), req.durationHours(), req.handoffDate(), req.beforeHour(),
                s.index().byId(req.handoffMarketDayId()).orElse(null));
    }

    /**
     * Port of findMoveSuggestion: find a not-started block on {@code date} that can move to another
     * free slot before its own handoff, freeing room for a new sale.
     */
    MoveSuggestionDto findMoveSuggestion(Snapshot s, LocalDate date, double duration, LocalDate handoffDate, Double beforeHour, MarketDay pickup) {
        if (s.paintingMarketMismatch(date, pickup).isPresent()) return null;
        CalendarIndex index = s.index();
        Optional<MarketDay> target = index.dayByDate(date);
        LocalDate todayDate = index.todayDay().map(MarketDay::getDate).orElse(index.today());
        if (target.isEmpty() || date.isAfter(handoffDate) || date.isBefore(todayDate) || duration <= 0) return null;
        if (!s.paintingOpen(date) || s.paintingsOn(date, null) > s.maxPaintings(date)) return null;
        MarketDay targetDay = target.get();

        List<OrderItem> onDay = s.items().stream()
                .filter(i -> i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(targetDay.getDate()))
                .sorted(Comparator.comparing(OrderItem::getPaintStart))
                .toList();
        for (OrderItem item : onDay) {
            double start = Hours.of(item.getPaintStart().toLocalTime());
            double end = Hours.of(item.getPaintEnd().toLocalTime());
            double blockDuration = end - start;
            if (blockDuration + Hours.EPS < duration) continue;
            if (start < s.paintingOpenHour(date) - Hours.EPS || start + duration > s.paintingCloseHour(date) + Hours.EPS) continue;
            if (beforeHour != null && start + duration > beforeHour + Hours.EPS) continue;
            if (item.getProductionStatus() != ProductionStatus.NOT_STARTED || item.getOrder().isUnconfirmedWeb()) continue;
            if (index.isToday(targetDay) && start < index.nowHour()) continue;
            LocalDate handoff = item.getHandoffDate();

            MarketDay itemPickup = s.marketPickup(item).orElse(null);
            for (LocalDate alt : CalendarRules.paintDatesToTry(handoff, todayDate)) {
                if (s.paintingMarketMismatch(alt, itemPickup).isPresent()) continue;
                HourSpanDto freed = new HourSpanDto(targetDay.getDate().toString(), start, start + duration);
                boolean sameDay = alt.equals(targetDay.getDate());
                CapacityResultDto alternative = findFreeSlot(s, alt, blockDuration, null, null,
                        sameDay ? List.of(new Busy("freed", freed.startHour(), freed.endHour())) : List.of(),
                        sameDay ? item.getId().toString() : null, null);
                if (!alternative.ok() || alternative.slot() == null) continue;
                if (alt.equals(handoff) && (item.getDeliveryKind() != DeliveryKind.MARKET || item.getPickUpTime() == null
                        || alternative.slot().endHour() + PAINT_HANDLING_HOURS > Hours.of(item.getPickUpTime()) + Hours.EPS)) continue;
                String title = item.getPetName() == null || item.getPetName().isBlank() ? "Walk-in order" : item.getPetName();
                return new MoveSuggestionDto(item.getId().toString(), item.getOrder().getCode(), title,
                        new HourSpanDto(targetDay.getDate().toString(), start, end), alternative.slot(), freed);
            }
        }
        return null;
    }

    // ─── Move block ─────────────────────────────────────────────────────────

    @Transactional
    public void moveBlock(UUID blockId, LocalDate date, double startHour) {
        calendarService.lockSchedule();
        Snapshot s = snapshot();
        OrderItem item = s.items().stream().filter(i -> i.getId().equals(blockId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Block not found"));
        if (item.getPaintStart() == null) throw new BadRequestException("This session is not linked to an order");
        if (item.getProductionStatus() != ProductionStatus.NOT_STARTED) {
            throw new ConflictException("Only not started sessions can be moved");
        }
        s.assertPaintingLocation(date, s.marketPickup(item).orElse(null));
        double duration = Hours.of(item.getPaintEnd().toLocalTime()) - Hours.of(item.getPaintStart().toLocalTime());
        CalendarIndex index = s.index();
        MarketDay day = index.dayByDate(date).orElseThrow(() -> new BadRequestException("No market day"));
        if (!s.paintingOpen(date)) throw new ConflictException("Painting is closed on this day.");
        if (s.paintingsOn(date, blockId.toString()) >= s.maxPaintings(date)) {
            throw new ConflictException("Daily painting limit reached.");
        }
        double start = Hours.snap(startHour);
        double end = start + duration;
        if (start < s.paintingOpenHour(date) - Hours.EPS || end > s.paintingCloseHour(date) + Hours.EPS) {
            throw new BadRequestException("Outside painting hours");
        }
        if (s.busyOn(date, blockId.toString()).stream().anyMatch(b -> Hours.overlap(start, end, b.start(), b.end()))) {
            throw new ConflictException("That time overlaps another block");
        }
        if (date.isBefore(index.today()) || (index.isToday(day) && start < index.nowHour())) {
            throw new BadRequestException("That time has already passed");
        }
        assertBeforeHandoff(item.getDeliveryKind(), item.getHandoffDate(),
                item.getPickUpTime() == null ? null : Hours.of(item.getPickUpTime()), date, end, true);
        item.setPaintStart(date.atTime(Hours.toTime(start)));
        item.setPaintEnd(date.atTime(Hours.toTime(end)));
    }

    @Transactional
    public MakeRoomResultDto makeRoom(UUID itemId) {
        calendarService.lockSchedule();
        Snapshot s = snapshot();
        OrderItem item = s.items().stream().filter(i -> i.getId().equals(itemId)).findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Block not found"));
        if (!MakeRoomPlanner.isMovable(item)) {
            throw new ConflictException("This painting session cannot be moved.").code("SESSION_NOT_MOVABLE");
        }

        MakeRoomResultDto.Move move = new MakeRoomPlanner(s).moveOne(item)
                .orElseThrow(() -> new ConflictException("No free painting slot keeps the promised handoff.")
                        .code("NO_SLOT_KEEPS_PROMISE"));
        applyMove(s, item, move.to());
        return new MakeRoomResultDto(null, List.of(move));
    }

    @Transactional
    public MakeRoomResultDto makeRoom(MakeRoomRequest request, String key) {
        calendarService.lockSchedule();
        String requestHash = sha256(objectMapper.writeValueAsString(request));
        var replay = makeRoomReplays.findById(key);
        if (replay.isPresent()) {
            if (!replay.get().getRequestHash().equals(requestHash)) {
                throw new com.artwithgab.awg_tracking.exception.ConflictException(
                        "This request key was already used for another request.").code("IDEMPOTENCY_KEY_REUSED");
            }
            return objectMapper.readValue(replay.get().getResponseBody(), MakeRoomResultDto.class);
        }

        Snapshot s = snapshot();
        MarketDay requestedStall = s.index().byId(request.marketDayId())
                .filter(day -> day.getMarket().getKind() == MarketKind.MARKET)
                .orElse(null);
        s.assertPaintingLocation(request.date(), requestedStall);
        MakeRoomResultDto result = new MakeRoomPlanner(s).makeRoom(request);
        for (var move : result.moved()) {
            OrderItem item = s.items().stream().filter(i -> i.getId().toString().equals(move.itemId()))
                    .findFirst().orElseThrow();
            applyMove(s, item, move.to());
        }
        makeRoomReplays.save(new MakeRoomReplay(key, requestHash, objectMapper.writeValueAsString(result)));
        return result;
    }

    private static String sha256(String text) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void applyMove(Snapshot snapshot, OrderItem item, HourSpanDto slot) {
        LocalDate date = LocalDate.parse(slot.date());
        snapshot.assertPaintingLocation(date, snapshot.marketPickup(item).orElse(null));
        item.setPaintStart(date.atTime(Hours.toTime(slot.startHour())));
        item.setPaintEnd(date.atTime(Hours.toTime(slot.endHour())));
    }

    /** Painting for Post and legacy Vienna orders must finish before the handoff day. */
    static void assertBeforeHandoff(DeliveryKind kind, LocalDate handoff, Double pickupHour, LocalDate paintDate, double paintEnd, boolean moving) {
        if (paintDate.isAfter(handoff)) {
            throw new BadRequestException(moving ? "Painting must stay before pickup" : "Choose a paint time before pickup, within working hours.");
        }
        if (kind != DeliveryKind.MARKET && paintDate.equals(handoff)) {
            throw new BadRequestException(kind == DeliveryKind.POST
                    ? "Post orders must be painted before collection day"
                    : "Vienna orders must be painted before the handoff day");
        }
        if (kind == DeliveryKind.MARKET && paintDate.equals(handoff) && pickupHour != null
                && paintEnd + PAINT_HANDLING_HOURS > pickupHour + Hours.EPS) {
            throw new BadRequestException(moving
                    ? "This session must finish before pickup at " + Hours.format(pickupHour)
                    : "Choose a paint time before pickup, within working hours.");
        }
    }
}
