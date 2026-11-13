package com.artwithgab.awg_tracking.dto.stats;

import java.math.BigDecimal;
import java.util.List;

/**
 * Staff Statistics for a date range (Vienna calendar days, both inclusive). Sales exclude cancelled
 * orders and web checkouts that are not paid yet; those are counted separately.
 */
public record StatsDto(String from, String to, Sales sales, List<SourceRow> bySource, List<DayRow> daily,
                       List<ColorRow> colors, Delivery delivery, Web web) {

    public record Sales(int orders, int ornaments, int custom, int finished, int withName,
                        BigDecimal revenue, BigDecimal received, BigDecimal outstanding, BigDecimal averageOrder,
                        int cancelled, int checkoutsInProgress) {}

    public record SourceRow(String source, int orders, int ornaments, BigDecimal revenue) {}

    public record DayRow(String date, int orders, int ornaments, BigDecimal revenue, long visits) {}

    public record ColorRow(String color, String finish, int count) {}

    public record Delivery(int market, int vienna) {}

    /** visits = Home + shop + Track + QR form page loads. funnel follows one /buy session's path. */
    public record Web(long homeViews, long buyViews, long trackViews, long formViews,
                      List<FunnelStep> funnel, List<ErrorRow> validationErrors, long nameOn, long nameOff) {}

    public record FunnelStep(String stage, long count) {}

    public record ErrorRow(String step, String field, String code, long count) {}
}
