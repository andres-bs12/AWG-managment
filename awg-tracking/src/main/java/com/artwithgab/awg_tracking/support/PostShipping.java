package com.artwithgab.awg_tracking.support;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public record PostShipping(Set<DayOfWeek> collectionDays, LocalDate collectionsFrom,
                           int transitMinDays, int transitMaxDays, LocalDate lastArrival,
                           Map<LocalDate, Boolean> overrides) {
    public PostShipping {
        collectionDays = Set.copyOf(collectionDays);
        overrides = Map.copyOf(overrides);
        if (collectionDays.isEmpty() || collectionDays.stream().anyMatch(day -> day.getValue() > 5)) {
            throw new IllegalArgumentException("Post collection days must be Monday to Friday");
        }
        if (transitMinDays < 1 || transitMaxDays < transitMinDays) {
            throw new IllegalArgumentException("Invalid Post transit days");
        }
    }

    public record Window(LocalDate collectionDate, LocalDate arrivalFrom, LocalDate arrivalTo) {}

    public LocalDate nextCollectionAfter(LocalDate readyOn) {
        LocalDate date = readyOn.plusDays(1);
        if (collectionsFrom != null && date.isBefore(collectionsFrom)) date = collectionsFrom;
        while (!isCollectionOn(date)) {
            date = date.plusDays(1);
        }
        return date;
    }

    public boolean isCollectionOn(LocalDate date) {
        if ((collectionsFrom != null && date.isBefore(collectionsFrom))
                || !AustrianHolidays.isWorkingDay(date)) return false;
        Boolean override = overrides.get(date);
        if (override != null) return override;
        if (collectionDays.contains(date.getDayOfWeek())) return true;

        // Every configured holiday since the last working day shifts here. If several
        // collections land on the same date, that date still has just one collection.
        for (LocalDate prior = date.minusDays(1); !AustrianHolidays.isWorkingDay(prior); prior = prior.minusDays(1)) {
            if (collectionDays.contains(prior.getDayOfWeek())) return true;
        }
        return false;
    }

    public Window arrivalFor(LocalDate collectionDate) {
        LocalDate from = addWorkingDays(collectionDate, transitMinDays);
        return new Window(collectionDate, from, addWorkingDays(from, transitMaxDays - transitMinDays));
    }

    public Optional<Window> windowAfter(LocalDate readyOn) {
        if (!readyOn.isBefore(lastArrival)) return Optional.empty();
        Window window = arrivalFor(nextCollectionAfter(readyOn));
        return window.arrivalTo().isAfter(lastArrival) ? Optional.empty() : Optional.of(window);
    }

    private static LocalDate addWorkingDays(LocalDate date, int days) {
        while (days > 0) {
            date = date.plusDays(1);
            if (AustrianHolidays.isWorkingDay(date)) days--;
        }
        return date;
    }
}
