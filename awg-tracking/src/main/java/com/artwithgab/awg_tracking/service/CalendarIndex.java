package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.support.Hours;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Snapshot of all market days plus "now" in Vienna, built once per request.
 * Port of dayByDate / todayDay from the mock store: when a date has a stall day and a home day,
 * the stall wins.
 */
public final class CalendarIndex {
    /** Earliest opening stall wins; ties break by market name, then id. */
    public static final Comparator<MarketDay> STALL_ORDER = Comparator
            .comparing(MarketDay::getOpenTime, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(d -> d.getMarket() == null || d.getMarket().getName() == null ? "" : d.getMarket().getName())
            .thenComparing(d -> d.getId() == null ? "" : d.getId().toString());

    private final List<MarketDay> days;
    private final LocalDateTime now;
    private final UUID primaryPickupMarketId;

    public CalendarIndex(List<MarketDay> days, LocalDateTime now) {
        this(days.stream().sorted(Comparator.comparing(MarketDay::getDate).thenComparing(STALL_ORDER)).toList(), now, null);
    }

    private CalendarIndex(List<MarketDay> sortedDays, LocalDateTime now, UUID primaryPickupMarketId) {
        this.days = sortedDays;
        this.now = now;
        this.primaryPickupMarketId = primaryPickupMarketId;
    }

    CalendarIndex withPrimaryPickupMarket(UUID id) {
        return new CalendarIndex(days, now, id);
    }

    UUID primaryPickupMarketId() {
        return primaryPickupMarketId;
    }

    public List<MarketDay> days() {
        return days;
    }

    public LocalDate today() {
        return now.toLocalDate();
    }

    public double nowHour() {
        return Hours.of(now.toLocalTime());
    }

    /** Stored painting appointments have minute precision. Never round a new start back into the past. */
    double nextMinuteHour() {
        LocalDateTime minute = now.truncatedTo(ChronoUnit.MINUTES);
        return now.equals(minute) ? nowHour() : (minute.toLocalTime().toSecondOfDay() / 60 + 1) / 60.0;
    }

    double roundedQuarterHour() {
        double quarters = (double) now.toLocalTime().toNanoOfDay() / Duration.ofMinutes(15).toNanos();
        return Math.max(1, Math.ceil(quarters)) / 4;
    }

    public boolean isToday(MarketDay day) {
        return day.getDate().equals(today());
    }

    public Optional<MarketDay> byId(UUID id) {
        if (id == null) return Optional.empty();
        return days.stream().filter(d -> d.getId().equals(id)).findFirst();
    }

    /** Preferred day for a date: a market stall day first, then home. */
    public Optional<MarketDay> dayByDate(LocalDate date) {
        return marketDayOn(date).or(() -> days.stream().filter(d -> d.getDate().equals(date)).findFirst());
    }

    public Optional<MarketDay> dayByDate(LocalDate date, UUID marketId) {
        if (marketId == null) return dayByDate(date);
        return days.stream()
                .filter(d -> d.getDate().equals(date) && d.getMarket().getId().equals(marketId))
                .findFirst();
    }

    public List<MarketDay> marketDaysOn(LocalDate date) {
        return days.stream()
                .filter(d -> d.getDate().equals(date) && d.getMarket().getKind() == MarketKind.MARKET)
                .toList();
    }

    /** Stable fallback for date-only records and the shared painting calendar. */
    public Optional<MarketDay> marketDayOn(LocalDate date) {
        return marketDaysOn(date).stream().findFirst();
    }

    /**
     * Deterministic stall choice for inherited painting hours on a date:
     * 1. the market Gaby paints at on that date ("paints at" on PaintingDay), if open;
     * 2. the configured primary pickup market's day on that date, if open;
     * 3. the stall that opens earliest (tie: market name).
     */
    public static Optional<MarketDay> effectivePaintingStall(List<MarketDay> stallsOnDate, UUID paintingMarketId, UUID primaryPickupMarketId) {
        if (stallsOnDate == null || stallsOnDate.isEmpty()) return Optional.empty();
        List<MarketDay> sorted = stallsOnDate.stream().sorted(STALL_ORDER).toList();
        if (paintingMarketId != null) {
            Optional<MarketDay> chosen = sorted.stream()
                    .filter(d -> d.getMarket() != null && paintingMarketId.equals(d.getMarket().getId()))
                    .findFirst();
            if (chosen.isPresent()) return chosen;
        }
        if (primaryPickupMarketId != null) {
            Optional<MarketDay> primary = sorted.stream()
                    .filter(d -> d.getMarket() != null && primaryPickupMarketId.equals(d.getMarket().getId()))
                    .findFirst();
            if (primary.isPresent()) return primary;
        }
        return Optional.of(sorted.getFirst());
    }

    public Optional<MarketDay> paintingDayOn(LocalDate date, UUID paintingMarketId, UUID primaryPickupMarketId) {
        return effectivePaintingStall(marketDaysOn(date), paintingMarketId, primaryPickupMarketId)
                .or(() -> dayByDate(date));
    }

    public Optional<MarketDay> pickupDay(OrderItem item) {
        return Optional.ofNullable(item.getHandoffDay()).or(() -> marketDayOn(item.getHandoffDate()));
    }

    /** Today's day, or the first known day (same fallback as the mock). */
    public Optional<MarketDay> todayDay() {
        return dayByDate(today()).or(() -> days.stream().findFirst());
    }
}
