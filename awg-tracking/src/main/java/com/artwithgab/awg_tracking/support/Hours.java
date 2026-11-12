package com.artwithgab.awg_tracking.support;

import com.artwithgab.awg_tracking.exception.BadRequestException;

import java.time.LocalTime;

/**
 * The frontend works with decimal hours (10.25 = 10:15). The database stores LocalTime.
 * Ports of formatHour / formatMinutes / hoursOverlap from frontend/src/lib/time.ts.
 */
public final class Hours {
    public static final double EPS = 0.001;

    private Hours() {
    }

    public static double of(LocalTime time) {
        return time.getHour() + time.getMinute() / 60.0;
    }

    /** Rounds to the minute. 24 is not a valid time of day. */
    public static LocalTime toTime(double hour) {
        if (!Double.isFinite(hour) || hour < 0 || hour >= 24) {
            throw new BadRequestException("Hour out of range");
        }
        int minutes = (int) Math.round(hour * 60);
        if (minutes >= 24 * 60) minutes = 24 * 60 - 1;
        return LocalTime.of(minutes / 60, minutes % 60);
    }

    /** Snaps a decimal hour to the minute, as the DB would store it. */
    public static double snap(double hour) {
        return Math.round(hour * 60) / 60.0;
    }

    public static String format(double h) {
        int hh = (int) Math.floor(h);
        int mm = (int) Math.round((h - hh) * 60);
        if (mm == 60) {
            hh += 1;
            mm = 0;
        }
        return String.format("%02d:%02d", hh, mm);
    }

    public static String formatMinutes(int minutes) {
        if (minutes == 45) return "45 min";
        if (minutes == 60) return "1 h";
        if (minutes == 75) return "1 h 15";
        if (minutes % 60 == 0) return (minutes / 60) + " h";
        int h = minutes / 60;
        int m = minutes % 60;
        if (h == 0) return m + " min";
        return h + " h " + String.format("%02d", m);
    }

    /** True if half-open hour ranges overlap (same tolerance as the frontend). */
    public static boolean overlap(double a0, double a1, double b0, double b1) {
        return a0 < b1 - 0.01 && a1 > b0 + 0.01;
    }
}
