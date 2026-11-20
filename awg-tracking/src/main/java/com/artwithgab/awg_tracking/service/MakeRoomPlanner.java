package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.agenda.MakeRoomRequest;
import com.artwithgab.awg_tracking.dto.agenda.MakeRoomResultDto;
import com.artwithgab.awg_tracking.dto.agenda.MakeRoomResultDto.Move;
import com.artwithgab.awg_tracking.dto.common.HourSpanDto;
import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.exception.ApiException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.support.Hours;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import static com.artwithgab.awg_tracking.service.AgendaService.findFreeSlot;

/** Searches the locked agenda without changing any managed order items. */
final class MakeRoomPlanner {
    private static final Comparator<HourSpanDto> BY_START =
            Comparator.comparing(HourSpanDto::date).thenComparingDouble(HourSpanDto::startHour);

    private final AgendaService.Snapshot snapshot;
    private final LocalDate today;
    private final List<LocalDate> paintingDates;

    MakeRoomPlanner(AgendaService.Snapshot snapshot) {
        this.snapshot = snapshot;
        today = snapshot.index().today();
        paintingDates = snapshot.index().days().stream().map(MarketDay::getDate).distinct()
                .filter(date -> !date.isBefore(today) && snapshot.paintingOpen(date) && snapshot.maxPaintings(date) > 0)
                .toList();
    }

    static boolean isMovable(OrderItem item) {
        return item.getPaintStart() != null && item.getPaintEnd() != null
                && item.getHandoffDate().isAfter(item.getPaintStart().toLocalDate())
                && item.getProductionStatus() == ProductionStatus.NOT_STARTED && !item.isHandedOver();
    }

    Optional<Move> moveOne(OrderItem item) {
        HourSpanDto original = span(item);
        LocalDate paintDate = item.getPaintStart().toLocalDate();
        double duration = original.endHour() - original.startHour();
        List<LocalDate> dates = targetDates(item);
        for (LocalDate date : dates) {
            boolean sameDay = date.equals(paintDate);
            double after = sameDay ? Math.max(floor(date), original.endHour()) : floor(date);
            var result = findFreeSlot(snapshot, date, defaultDay(date), duration, after, List.of(),
                    item.getId().toString(), null);
            if (result.ok()) return Optional.of(move(item, result.slot()));
        }
        // Keep the entire original block free when the only option is earlier on the same day.
        if (dates.contains(paintDate)) {
            var result = findFreeSlot(snapshot, paintDate, defaultDay(paintDate), duration, floor(paintDate), List.of(),
                    item.getId().toString(), original.startHour());
            if (result.ok()) return Optional.of(move(item, result.slot()));
        }
        return Optional.empty();
    }

    MakeRoomResultDto makeRoom(MakeRoomRequest request) {
        LocalDate date = request.date();
        CalendarIndex index = snapshot.index();
        MarketDay source = (request.marketDayId() == null ? index.dayByDate(date)
                : index.byId(request.marketDayId()).filter(day -> day.getDate().equals(date)
                        && day.getMarket().getKind() == MarketKind.MARKET)).orElse(null);
        if (source == null || !paintingDates.contains(date)) {
            throw unavailable("NOT_PAINTING_DAY", "Painting is unavailable on this day.");
        }

        double duration = request.minutes() / 60.0;
        var free = findFreeSlot(snapshot, date, source, duration, floor(date), List.of(), null, null);
        if (free.ok()) return new MakeRoomResultDto(free.slot(), List.of());

        List<OrderItem> onDay = snapshot.items().stream()
                .filter(item -> item.getPaintStart() != null && item.getPaintStart().toLocalDate().equals(date))
                .toList();
        if (!onDay.isEmpty() && onDay.stream().allMatch(item -> date.equals(item.getHandoffDate()))) {
            throw unavailable("SAME_DAY_ONLY", "All of today's sessions are for pickups today, so none can be moved.");
        }
        List<OrderItem> candidates = onDay.stream().filter(MakeRoomPlanner::isMovable)
                .sorted(Comparator.comparing(OrderItem::getHandoffDate).reversed()
                        .thenComparing(OrderItem::getPaintStart).thenComparing(OrderItem::getId))
                .toList();

        // If even removing every movable session cannot fit the request, no subset can work.
        if (findFreeSlot(without(candidates), date, source, duration, floor(date), List.of(), null, null).ok()) {
            int minimum = Math.max(1, onDay.size() - snapshot.maxPaintings(date) + 1);
            for (int count = minimum; count <= candidates.size(); count++) {
                var plan = selectMoves(source, duration, candidates, new ArrayList<>(), 0, count);
                if (plan != null) return plan;
            }
        }
        throw unavailable("NO_TARGET_SLOT", "No available painting slots can free this time and keep the promised handoffs.");
    }

    private MakeRoomResultDto selectMoves(MarketDay source, double duration, List<OrderItem> candidates,
                                         List<OrderItem> selected, int start, int remaining) {
        if (remaining == 0) return planMoves(source, duration, selected);
        for (int i = start; i <= candidates.size() - remaining; i++) {
            selected.add(candidates.get(i));
            var plan = selectMoves(source, duration, candidates, selected, i + 1, remaining - 1);
            selected.removeLast();
            if (plan != null) return plan;
        }
        return null;
    }

    private MakeRoomResultDto planMoves(MarketDay source, double duration, List<OrderItem> selected) {
        AgendaService.Snapshot remaining = without(selected);
        List<OrderItem> byDeadline = selected.stream().sorted(Comparator.comparing(OrderItem::getHandoffDate)).toList();
        for (HourSpanDto slot : freeSlots(remaining, source, duration, List.of()).toList()) {
            Map<LocalDate, List<AgendaService.Busy>> planned = new HashMap<>();
            planned.put(source.getDate(), new ArrayList<>(List.of(busy("requested", slot))));
            List<Move> moves = new ArrayList<>();
            if (placeMoves(source, remaining, byDeadline, planned, moves, new HashSet<>())) {
                return new MakeRoomResultDto(slot, List.copyOf(moves));
            }
        }
        return null;
    }

    private boolean placeMoves(MarketDay source, AgendaService.Snapshot remaining, List<OrderItem> selected,
                               Map<LocalDate, List<AgendaService.Busy>> planned, List<Move> moves,
                               Set<List<HourSpanDto>> visited) {
        if (moves.size() == selected.size()) return true;
        // The remaining items are fixed by the depth. Equivalent occupied spans need only one search.
        if (!visited.add(moves.stream().map(Move::to).sorted(BY_START).toList())) return false;
        OrderItem item = selected.get(moves.size());
        HourSpanDto original = span(item);
        for (LocalDate date : targetDates(item)) {
            MarketDay day = date.equals(source.getDate()) ? source : defaultDay(date);
            List<AgendaService.Busy> occupied = planned.computeIfAbsent(date, ignored -> new ArrayList<>());
            for (HourSpanDto slot : freeSlots(remaining, day, original.endHour() - original.startHour(), occupied).toList()) {
                occupied.add(busy(item.getId().toString(), slot));
                moves.add(move(item, slot));
                if (placeMoves(source, remaining, selected, planned, moves, visited)) return true;
                moves.removeLast();
                occupied.removeLast();
            }
        }
        return false;
    }

    private Stream<HourSpanDto> freeSlots(AgendaService.Snapshot s, MarketDay day, double duration,
                                        List<AgendaService.Busy> extra) {
        LocalDate date = day.getDate();
        double floor = floor(date);
        // A gap's earliest placement leaves the most contiguous space for subsequent moves.
        return Stream.concat(Stream.of(floor), Stream.concat(s.busyOn(date, null).stream(), extra.stream())
                        .map(AgendaService.Busy::end).filter(end -> end > floor).sorted())
                .distinct()
                .map(after -> findFreeSlot(s, date, day, duration, after, extra, null, null))
                .filter(result -> result.ok()).map(result -> result.slot()).distinct();
    }

    private AgendaService.Snapshot without(List<OrderItem> selected) {
        var removed = new HashSet<>(selected);
        return new AgendaService.Snapshot(snapshot.index(),
                snapshot.items().stream().filter(item -> !removed.contains(item)).toList(),
                snapshot.paintingDays(), snapshot.defaultMaxPaintings());
    }

    private List<LocalDate> targetDates(OrderItem item) {
        LocalDate original = item.getPaintStart().toLocalDate();
        // The existing handoff-day buffer requires all painting to finish on an earlier date.
        return paintingDates.stream().filter(date -> date.isBefore(item.getHandoffDate()))
                .sorted(Comparator.comparing((LocalDate date) -> date.isBefore(original)).thenComparing(date -> date))
                .toList();
    }

    private MarketDay defaultDay(LocalDate date) {
        return snapshot.index().dayByDate(date).orElseThrow();
    }

    private double floor(LocalDate date) {
        return date.equals(today) ? snapshot.index().nextMinuteHour() : 0;
    }

    private static AgendaService.Busy busy(String id, HourSpanDto span) {
        return new AgendaService.Busy(id, span.startHour(), span.endHour());
    }

    private static Move move(OrderItem item, HourSpanDto slot) {
        return new Move(item.getId().toString(), item.getOrder().getCode(), span(item), slot);
    }

    private static HourSpanDto span(OrderItem item) {
        return new HourSpanDto(item.getPaintStart().toLocalDate().toString(),
                Hours.of(item.getPaintStart().toLocalTime()), Hours.of(item.getPaintEnd().toLocalTime()));
    }

    private static ApiException unavailable(String reason, String message) {
        return new ConflictException(message).code("NO_MOVABLE_SESSION").reason(reason);
    }
}
