package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.agenda.*;
import com.artwithgab.awg_tracking.dto.common.HourSpanDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.OrderItemRepository;
import com.artwithgab.awg_tracking.support.CalendarRules;
import com.artwithgab.awg_tracking.support.Hours;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    /** A busy painting range on one date. */
    record Busy(String id, double start, double end) {
    }

    /** Data for one request: calendar plus every item. */
    record Snapshot(CalendarIndex index, List<OrderItem> items, Map<LocalDate, com.artwithgab.awg_tracking.model.PaintingDay> paintingDays,
                    int defaultMaxPaintings) {
        /** Custom ornaments painted on a date (pending web orders included: they hold their time). */
        int paintingsOn(LocalDate date, String ignoreId) {
            return (int) items.stream()
                    .filter(i -> i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(date))
                    .filter(i -> ignoreId == null || !i.getId().toString().equals(ignoreId))
                    .count();
        }

        boolean paintingOpen(LocalDate date) {
            var rule = paintingDays.get(date);
            return rule == null || rule.isOpen();
        }

        int maxPaintings(LocalDate date) {
            var rule = paintingDays.get(date);
            return rule == null ? defaultMaxPaintings : rule.getMaxPaintings();
        }

        List<Busy> busyOn(LocalDate date, String ignoreId) {
            return items.stream()
                    .filter(i -> i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(date))
                    .filter(i -> !i.getId().toString().equals(ignoreId))
                    .map(i -> new Busy(i.getId().toString(), Hours.of(i.getPaintStart().toLocalTime()), Hours.of(i.getPaintEnd().toLocalTime())))
                    .sorted(Comparator.comparingDouble(Busy::start))
                    .toList();
        }
    }

    Snapshot snapshot() {
        Map<LocalDate, com.artwithgab.awg_tracking.model.PaintingDay> rules = new HashMap<>();
        paintingDayRepository.findAll().forEach(d -> rules.put(d.getDate(), d));
        return new Snapshot(calendarService.snapshot(), orderItemRepository.findAllWithOrder(), rules,
                props.calendar().defaultMaxPaintings());
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
        MarketDay day = index.dayByDate(date).or(index::todayDay)
                .orElseThrow(() -> new ResourceNotFoundException("No market day on that date."));
        List<AgendaSlotDto> slots = s.items().stream()
                .filter(i -> i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(day.getDate()))
                .filter(i -> !i.getOrder().isAwaitingPayment())
                .sorted(Comparator.comparing(OrderItem::getPaintStart))
                .map(i -> new AgendaSlotDto(mapper.block(i, index), mapper.order(i.getOrder()), mapper.item(i, index), mapper.customer(i.getOrder().getCustomer())))
                .toList();
        return new AgendaDayDto(mapper.marketDay(day, index.today()), mapper.market(day.getMarket()), slots, deliveries(s, day.getDate()));
    }

    private List<AgendaDeliveryDto> deliveries(Snapshot s, LocalDate date) {
        List<AgendaDeliveryDto> rows = new ArrayList<>();
        for (OrderItem item : s.items()) {
            if (!date.equals(item.getHandoffDate())) continue;
            Order order = item.getOrder();
            if (order.isAwaitingPayment()) continue;
            var customer = order.getCustomer();
            String title = firstNonBlank(item.getPetName(), customer.getName(), "Ornament");
            String photoUrl = item.getPhotos().isEmpty() ? null : ViewMapper.photoUrl(item.getPhotos().getFirst());
            boolean market = item.getDeliveryKind() == DeliveryKind.MARKET;
            Double hour = market && item.getPickUpTime() != null ? Hours.of(item.getPickUpTime()) : null;
            rows.add(new AgendaDeliveryDto(
                    customer.getName(), item.getCustomColor(), ViewMapper.nz(item.getNameInOrnament()),
                    order.getId().toString(), order.getCode(), item.getId().toString(), title,
                    item.getProductionStatus(), order.isHandedOver(), item.getDeliveryKind(), hour,
                    market ? "Market pickup" : "Vienna · Wed/Fri",
                    hour == null ? null : Hours.format(hour),
                    customer.getPhone(),
                    market ? null : addressLabel(order),
                    photoUrl));
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

    // ─── Capacity ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CapacityResultDto checkCapacity(CapacityRequest req) {
        List<Busy> extra = req.extraBusy() == null ? List.of()
                : req.extraBusy().stream().map(b -> new Busy("draft", b.startHour(), b.endHour())).toList();
        return findFreeSlot(snapshot(), req.date(), req.durationHours(), req.afterHour(), null, extra, null, req.beforeHour());
    }

    /** Port of findFreeSlot: first gap of durationHours between afterHour and beforeHour on that date. */
    CapacityResultDto findFreeSlot(Snapshot s, LocalDate date, double duration, Double afterHour, UUID marketId,
                                   List<Busy> extraBusy, String ignoreBlockId, Double beforeHour) {
        CalendarIndex index = s.index();
        // Automatic planning respects Gaby's day switch and daily limit; manual moves do not come here.
        if (!s.paintingOpen(date)) return new CapacityResultDto(false, null, 0, "Painting is closed on this day.");
        if (s.paintingsOn(date, ignoreBlockId) + extraBusy.size() >= s.maxPaintings(date)) {
            return new CapacityResultDto(false, null, 0, "Daily painting limit reached.");
        }
        Optional<MarketDay> found = index.dayByDate(date, marketId).or(() -> index.dayByDate(date));
        if (found.isEmpty()) return new CapacityResultDto(false, null, 0, "No market day on that date.");
        MarketDay day = found.get();
        double open = Hours.of(day.getOpenTime());
        double close = Hours.of(day.getCloseTime());
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
        return findMoveSuggestion(snapshot(), req.date(), req.durationHours(), req.handoffDate(), req.beforeHour());
    }

    /**
     * Port of findMoveSuggestion: find a not-started block on {@code date} that can move to another
     * free slot before its own handoff, freeing room for a new sale.
     */
    MoveSuggestionDto findMoveSuggestion(Snapshot s, LocalDate date, double duration, LocalDate handoffDate, Double beforeHour) {
        CalendarIndex index = s.index();
        Optional<MarketDay> target = index.dayByDate(date);
        LocalDate todayDate = index.todayDay().map(MarketDay::getDate).orElse(index.today());
        if (target.isEmpty() || date.isAfter(handoffDate) || date.isBefore(todayDate) || duration <= 0) return null;
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
            if (beforeHour != null && start + duration > beforeHour + Hours.EPS) continue;
            if (item.getProductionStatus() != ProductionStatus.NOT_STARTED || item.getOrder().isAwaitingPayment()) continue;
            if (index.isToday(targetDay) && start < index.nowHour()) continue;
            LocalDate handoff = item.getHandoffDate();

            for (LocalDate alt : CalendarRules.paintDatesToTry(handoff, todayDate)) {
                HourSpanDto freed = new HourSpanDto(targetDay.getDate().toString(), start, start + duration);
                boolean sameDay = alt.equals(targetDay.getDate());
                CapacityResultDto alternative = findFreeSlot(s, alt, blockDuration, null, null,
                        sameDay ? List.of(new Busy("freed", freed.startHour(), freed.endHour())) : List.of(),
                        sameDay ? item.getId().toString() : null, null);
                if (!alternative.ok() || alternative.slot() == null) continue;
                if (alt.equals(handoff) && (item.getDeliveryKind() == DeliveryKind.DELIVERY || item.getPickUpTime() == null
                        || alternative.slot().endHour() > Hours.of(item.getPickUpTime()))) continue;
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
        double duration = Hours.of(item.getPaintEnd().toLocalTime()) - Hours.of(item.getPaintStart().toLocalTime());
        CalendarIndex index = s.index();
        MarketDay day = index.dayByDate(date).orElseThrow(() -> new BadRequestException("No market day"));
        double start = Hours.snap(startHour);
        double end = start + duration;
        if (start < Hours.of(day.getOpenTime()) - Hours.EPS || end > Hours.of(day.getCloseTime()) + Hours.EPS) {
            throw new BadRequestException("Outside market hours");
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

    /** Painting must end before the handoff. Vienna orders are painted on an earlier day. */
    static void assertBeforeHandoff(DeliveryKind kind, LocalDate handoff, Double pickupHour, LocalDate paintDate, double paintEnd, boolean moving) {
        if (paintDate.isAfter(handoff)) {
            throw new BadRequestException(moving ? "Painting must stay before pickup" : "Choose a paint time before pickup, within working hours.");
        }
        if (kind == DeliveryKind.DELIVERY && !paintDate.isBefore(handoff)) {
            throw new BadRequestException("Vienna orders must be painted before the handoff day");
        }
        if (kind == DeliveryKind.MARKET && paintDate.equals(handoff) && pickupHour != null && paintEnd > pickupHour + Hours.EPS) {
            throw new BadRequestException(moving
                    ? "This session must finish before pickup at " + Hours.format(pickupHour)
                    : "Choose a paint time before pickup, within working hours.");
        }
    }
}
