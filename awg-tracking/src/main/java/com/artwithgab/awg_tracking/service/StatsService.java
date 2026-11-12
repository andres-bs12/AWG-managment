package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.dto.stats.StatsDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.OrderSource;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.model.BuyMetric;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.BuyMetricRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Predicate;

/** Aggregates for the staff Statistics page. Read-only; never exposes customer data. */
@Service
@RequiredArgsConstructor
public class StatsService {
    static final int MAX_DAYS = 400;

    private final OrderRepository orders;
    private final BuyMetricRepository metrics;
    private final AwgProperties props;

    @Transactional(readOnly = true)
    public StatsDto stats(LocalDate from, LocalDate to) {
        if (from.isAfter(to) || ChronoUnit.DAYS.between(from, to) > MAX_DAYS) {
            throw new BadRequestException("Choose a range of up to " + MAX_DAYS + " days.");
        }
        ZoneId zone = ZoneId.of(props.zone());
        List<Order> created = orders.findCreatedBetween(from.atStartOfDay(zone).toInstant(), to.plusDays(1).atStartOfDay(zone).toInstant());

        Predicate<Order> cancelled = o -> "CANCELLED".equals(o.getStatus());
        List<Order> sold = created.stream().filter(cancelled.negate()).filter(o -> !o.isUnconfirmedWeb()).toList();
        int inProgress = (int) created.stream().filter(cancelled.negate()).filter(Order::isUnconfirmedWeb).count();
        int cancelledCount = (int) created.stream().filter(cancelled).count();

        List<OrderItem> items = sold.stream().flatMap(o -> o.getOrderItems().stream()).toList();
        BigDecimal revenue = sum(sold.stream().map(Order::getTotal).toList());
        BigDecimal received = sum(sold.stream().map(o -> o.getAmountPaid() == null ? BigDecimal.ZERO : o.getAmountPaid()).toList());
        var sales = new StatsDto.Sales(sold.size(), items.size(),
                count(items, i -> i.getItemKind() == ItemKind.CUSTOM), count(items, i -> i.getItemKind() == ItemKind.GENERIC),
                count(items, OrderItem::isWithName), revenue, received, revenue.subtract(received).max(BigDecimal.ZERO),
                sold.isEmpty() ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(sold.size()), 2, RoundingMode.HALF_UP),
                cancelledCount, inProgress);

        List<StatsDto.SourceRow> bySource = Arrays.stream(OrderSource.values()).map(source -> {
            List<Order> rows = sold.stream().filter(o -> o.getSource() == source).toList();
            return new StatsDto.SourceRow(source.name().toLowerCase(Locale.ROOT), rows.size(),
                    rows.stream().mapToInt(o -> o.getOrderItems().size()).sum(), sum(rows.stream().map(Order::getTotal).toList()));
        }).toList();

        List<BuyMetric> rows = metrics.findByDateBetweenOrderByDateAsc(from, to);
        Map<LocalDate, Long> visitsByDay = new HashMap<>();
        for (BuyMetric m : rows) {
            if (Set.of("home_view", "buy_view", "track_view", "form_view").contains(m.getEvent())) {
                visitsByDay.merge(m.getDate(), m.getCount(), Long::sum);
            }
        }
        List<StatsDto.DayRow> daily = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            LocalDate d = day;
            List<Order> onDay = sold.stream().filter(o -> o.getCreatedAt().atZone(zone).toLocalDate().equals(d)).toList();
            daily.add(new StatsDto.DayRow(d.toString(), onDay.size(), onDay.stream().mapToInt(o -> o.getOrderItems().size()).sum(),
                    sum(onDay.stream().map(Order::getTotal).toList()), visitsByDay.getOrDefault(d, 0L)));
        }

        Map<String, Integer> colorCounts = new TreeMap<>();
        for (OrderItem item : items) {
            if (item.getItemKind() != ItemKind.CUSTOM || item.getCustomColor() == null) continue;
            String finish = item.getCustomFinish() == null ? "shiny" : item.getCustomFinish().name().toLowerCase(Locale.ROOT);
            colorCounts.merge(item.getCustomColor().name().toLowerCase(Locale.ROOT) + "|" + finish, 1, Integer::sum);
        }
        List<StatsDto.ColorRow> colors = colorCounts.entrySet().stream()
                .map(e -> new StatsDto.ColorRow(e.getKey().split("\\|")[0], e.getKey().split("\\|")[1], e.getValue()))
                .sorted(Comparator.comparingInt(StatsDto.ColorRow::count).reversed()).toList();

        var delivery = new StatsDto.Delivery(count(items, i -> i.getDeliveryKind() != DeliveryKind.DELIVERY),
                count(items, i -> i.getDeliveryKind() == DeliveryKind.DELIVERY));

        return new StatsDto(from.toString(), to.toString(), sales, bySource, daily, colors, delivery, web(rows));
    }

    private static StatsDto.Web web(List<BuyMetric> rows) {
        var funnel = List.of(
                new StatsDto.FunnelStep("opened", total(rows, "buy_view", "", "")),
                new StatsDto.FunnelStep("delivery", total(rows, "buy_step", "delivery", null)),
                new StatsDto.FunnelStep("review", total(rows, "buy_step", "review", null)),
                new StatsDto.FunnelStep("pay_click", total(rows, "buy_pay_click", null, null)),
                new StatsDto.FunnelStep("paid", total(rows, "buy_paid", null, null)));
        Map<String, Long> errors = new TreeMap<>();
        for (BuyMetric m : rows) {
            if ("buy_validation_error".equals(m.getEvent())) errors.merge(m.getStep() + "|" + m.getField() + "|" + m.getValue(), m.getCount(), Long::sum);
        }
        List<StatsDto.ErrorRow> errorRows = errors.entrySet().stream().map(e -> {
            String[] k = e.getKey().split("\\|", -1);
            return new StatsDto.ErrorRow(k[0], k[1], k[2], e.getValue());
        }).sorted(Comparator.comparingLong(StatsDto.ErrorRow::count).reversed()).limit(10).toList();
        long nameOn = rows.stream().filter(m -> "buy_choice".equals(m.getEvent()) && "name".equals(m.getField()) && "on".equals(m.getValue())).mapToLong(BuyMetric::getCount).sum();
        long nameOff = rows.stream().filter(m -> "buy_choice".equals(m.getEvent()) && "name".equals(m.getField()) && "off".equals(m.getValue())).mapToLong(BuyMetric::getCount).sum();
        return new StatsDto.Web(total(rows, "home_view", null, null), total(rows, "buy_view", null, null),
                total(rows, "track_view", null, null), total(rows, "form_view", null, null), funnel, errorRows, nameOn, nameOff);
    }

    /** Sum of counts for an event; null step/field means "any". */
    private static long total(List<BuyMetric> rows, String event, String step, String field) {
        return rows.stream().filter(m -> event.equals(m.getEvent()))
                .filter(m -> step == null || step.equals(m.getStep()))
                .filter(m -> field == null || field.equals(m.getField()))
                .mapToLong(BuyMetric::getCount).sum();
    }

    private static int count(List<OrderItem> items, Predicate<OrderItem> test) {
        return (int) items.stream().filter(test).count();
    }

    private static BigDecimal sum(List<BigDecimal> values) {
        return values.stream().filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
