package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.support.Hours;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final List<MarketDay> days;
    private final LocalDateTime now;

    public CalendarIndex(List<MarketDay> days, LocalDateTime now) {
        this.days = days.stream()
                .sorted(Comparator.comparing(MarketDay::getDate).thenComparing(d -> d.getId().toString()))
                .toList();
        this.now = now;
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

    public boolean isToday(MarketDay day) {
        return day.getDate().equals(today());
    }

    public Optional<MarketDay> byId(UUID id) {
        if (id == null) return Optional.empty();
        return days.stream().filter(d -> d.getId().equals(id)).findFirst();
    }

    /** Preferred day for a date: a market stall day first, then home. */
    public Optional<MarketDay> dayByDate(LocalDate date) {
        return days.stream()
                .filter(d -> d.getDate().equals(date))
                .min(Comparator.comparing(d -> d.getMarket().getKind() == MarketKind.MARKET ? 0 : 1));
    }

    public Optional<MarketDay> dayByDate(LocalDate date, UUID marketId) {
        if (marketId == null) return dayByDate(date);
        return days.stream()
                .filter(d -> d.getDate().equals(date) && d.getMarket().getId().equals(marketId))
                .findFirst();
    }

    /** Stall day on that date, if the stall is open. */
    public Optional<MarketDay> marketDayOn(LocalDate date) {
        return days.stream()
                .filter(d -> d.getDate().equals(date) && d.getMarket().getKind() == MarketKind.MARKET)
                .findFirst();
    }

    /** Today's day, or the first known day (same fallback as the mock). */
    public Optional<MarketDay> todayDay() {
        return dayByDate(today()).or(() -> days.stream().findFirst());
    }
}
