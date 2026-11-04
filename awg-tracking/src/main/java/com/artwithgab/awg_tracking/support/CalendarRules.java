package com.artwithgab.awg_tracking.support;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Port of frontend/src/lib/calendar.ts. Business calendar rules from docs/README.md. */
public final class CalendarRules {
    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("EEE d MMM", Locale.UK);

    private CalendarRules() {
    }

    /** Market pickup: Friday, Saturday, Sunday. */
    public static boolean isMarketPickupDay(LocalDate date) {
        DayOfWeek d = date.getDayOfWeek();
        return d == DayOfWeek.FRIDAY || d == DayOfWeek.SATURDAY || d == DayOfWeek.SUNDAY;
    }

    /** Vienna delivery: Wednesday or Friday. */
    public static boolean isViennaDay(LocalDate date) {
        DayOfWeek d = date.getDayOfWeek();
        return d == DayOfWeek.WEDNESDAY || d == DayOfWeek.FRIDAY;
    }

    public static List<LocalDate> marketPickupDates(LocalDate start, LocalDate finish) {
        List<LocalDate> out = new ArrayList<>();
        if (start == null || finish == null || finish.isBefore(start)) return out;
        for (LocalDate d = start; !d.isAfter(finish); d = d.plusDays(1)) {
            if (isMarketPickupDay(d)) out.add(d);
        }
        return out;
    }

    /** Home painting hours: Mon/Tue/Thu 10–13, Wed/Fri 10–12, none at weekends. Null when closed. */
    public static LocalTime[] homePaintHours(LocalDate date) {
        return switch (date.getDayOfWeek()) {
            case MONDAY, TUESDAY, THURSDAY -> new LocalTime[]{LocalTime.of(10, 0), LocalTime.of(13, 0)};
            case WEDNESDAY, FRIDAY -> new LocalTime[]{LocalTime.of(10, 0), LocalTime.of(12, 0)};
            default -> null;
        };
    }

    /** First day painting may start for a handoff: Wed → Mon, Fri → Thu, weekend → Monday before. */
    public static LocalDate paintWindowStart(LocalDate handoff) {
        return switch (handoff.getDayOfWeek()) {
            case WEDNESDAY -> handoff.minusDays(2);
            case FRIDAY -> handoff.minusDays(1);
            case SATURDAY -> handoff.minusDays(5);
            case SUNDAY -> handoff.minusDays(6);
            default -> handoff.minusDays(handoff.getDayOfWeek().getValue() - 1L);
        };
    }

    public static List<LocalDate> paintDatesToTry(LocalDate handoff, LocalDate notBefore) {
        LocalDate start = paintWindowStart(handoff);
        LocalDate from = notBefore != null && notBefore.isAfter(start) ? notBefore : start;
        List<LocalDate> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(handoff); d = d.plusDays(1)) out.add(d);
        return out;
    }

    /** "Fri 28 Nov", like formatDateLabel in the frontend. */
    public static String label(LocalDate date) {
        return LABEL.format(date);
    }
}
