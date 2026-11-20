package com.artwithgab.awg_tracking.support;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.util.Set;

public final class AustrianHolidays {
    private static final Set<MonthDay> FIXED = Set.of(
            MonthDay.of(1, 1), MonthDay.of(1, 6), MonthDay.of(5, 1), MonthDay.of(8, 15),
            MonthDay.of(10, 26), MonthDay.of(11, 1), MonthDay.of(12, 8),
            MonthDay.of(12, 25), MonthDay.of(12, 26));

    private AustrianHolidays() {}

    public static boolean isWorkingDay(LocalDate date) {
        return date.getDayOfWeek().getValue() <= DayOfWeek.FRIDAY.getValue() && !isHoliday(date);
    }

    public static boolean isHoliday(LocalDate date) {
        if (FIXED.contains(MonthDay.from(date))) return true;
        if (date.getMonthValue() < 3 || date.getMonthValue() > 6) return false;
        long daysAfterEaster = date.toEpochDay() - easterSunday(date.getYear()).toEpochDay();
        return daysAfterEaster == 1 || daysAfterEaster == 39 || daysAfterEaster == 50 || daysAfterEaster == 60;
    }

    /** Gregorian Easter (Meeus/Jones/Butcher computus). */
    private static LocalDate easterSunday(int year) {
        int goldenNumber = Math.floorMod(year, 19);
        int century = Math.floorDiv(year, 100);
        int yearInCentury = Math.floorMod(year, 100);
        int leapCenturies = Math.floorDiv(century, 4);
        int lunarCorrection = Math.floorDiv(century - Math.floorDiv(century + 8, 25) + 1, 3);
        int epact = Math.floorMod(19 * goldenNumber + century - leapCenturies - lunarCorrection + 15, 30);
        int weekdayOffset = Math.floorMod(
                32 + 2 * Math.floorMod(century, 4) + 2 * (yearInCentury / 4) - epact - yearInCentury % 4, 7);
        int correction = (goldenNumber + 11 * epact + 22 * weekdayOffset) / 451;
        int result = epact + weekdayOffset - 7 * correction + 114;
        return LocalDate.of(year, result / 31, result % 31 + 1);
    }
}
