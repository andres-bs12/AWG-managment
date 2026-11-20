package com.artwithgab.awg_tracking.support;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PostShippingTests {
    private final PostShipping shipping = new PostShipping(Set.of(DayOfWeek.TUESDAY, DayOfWeek.FRIDAY),
            LocalDate.parse("2026-11-30"), 2, 3, LocalDate.parse("2026-12-23"), Map.of());

    @ParameterizedTest
    @CsvSource({
            "2026-11-30, 2026-12-01, 2026-12-03, 2026-12-04, true",
            "2026-12-06, 2026-12-09, 2026-12-11, 2026-12-14, true",
            "2026-12-08, 2026-12-09, 2026-12-11, 2026-12-14, true",
            "2026-12-09, 2026-12-11, 2026-12-15, 2026-12-16, true",
            "2026-12-17, 2026-12-18, 2026-12-22, 2026-12-23, true",
            "2026-12-18, 2026-12-22, 2026-12-24, 2026-12-28, false",
            "2026-11-20, 2026-12-01, 2026-12-03, 2026-12-04, true"
    })
    void plansCollectionsAndEnforcesArrivalCutoff(LocalDate ready, LocalDate collection,
                                                   LocalDate from, LocalDate to, boolean available) {
        assertThat(shipping.nextCollectionAfter(ready)).isEqualTo(collection);
        assertThat(shipping.arrivalFor(collection)).isEqualTo(new PostShipping.Window(collection, from, to));
        assertThat(shipping.windowAfter(ready).isPresent()).isEqualTo(available);
    }

    @Test
    void postCanCollectOnTheFirstShippingDayWhenItIsAConfiguredWeekday() {
        var mondays = new PostShipping(Set.of(DayOfWeek.MONDAY),
                LocalDate.parse("2026-11-30"), 2, 3, LocalDate.parse("2026-12-23"), Map.of());
        assertThat(mondays.nextCollectionAfter(LocalDate.parse("2026-11-27")))
                .isEqualTo(LocalDate.parse("2026-11-30"));
    }

    @ParameterizedTest
    @CsvSource({
            "2026-01-01", "2026-01-06", "2026-04-06", "2026-05-01", "2026-05-14", "2026-05-25",
            "2026-06-04", "2026-08-15", "2026-10-26", "2026-11-01", "2026-12-08", "2026-12-25",
            "2026-12-26", "2027-03-29", "2027-05-06", "2027-05-17", "2027-05-27"
    })
    void recognizesFixedAndEasterBasedHolidays(LocalDate date) {
        assertThat(AustrianHolidays.isHoliday(date)).isTrue();
    }

    @Test
    void christmasEveIsAWorkingDayWhenItFallsOnAWeekday() {
        assertThat(AustrianHolidays.isWorkingDay(LocalDate.parse("2026-12-24"))).isTrue();
        assertThat(AustrianHolidays.isWorkingDay(LocalDate.parse("2026-12-27"))).isFalse();
    }
}
