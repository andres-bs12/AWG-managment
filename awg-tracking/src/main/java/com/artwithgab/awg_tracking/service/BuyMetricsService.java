package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.model.BuyMetric;
import com.artwithgab.awg_tracking.repository.BuyMetricRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Service @RequiredArgsConstructor
public class BuyMetricsService {
    private static final Set<String> EVENTS = Set.of("buy_view", "buy_step", "buy_choice", "buy_photo_added", "buy_validation_error", "buy_pay_click", "buy_seq");
    private static final Set<String> STEPS = Set.of("", "design", "delivery", "details", "review");
    private static final Set<String> FIELDS = Set.of("", "color", "finish", "name", "photos", "date", "delivery", "pickupTime", "customerName", "email", "phone", "line1", "postalCode", "terms");
    private static final Set<String> VALUES = Set.of("", "red", "green", "beige", "shiny", "matte", "on", "off", "vienna", "market", "1", "2", "3", "4", "5", "6", "7", "required", "invalid");
    private final BuyMetricRepository repository;
    private final CalendarService calendar;
    private final Clock clock;
    public record Input(String event, String step, String field, String code, String value) {}
    private String clean(String s) { return s == null ? "" : s; }
    @Transactional
    public void record(Input input) {
        String step = clean(input.step()), field = clean(input.field()), value = clean(input.value());
        // The optional error code is validated and folded into the value; arbitrary text is never stored.
        String code = clean(input.code());
        if (!EVENTS.contains(clean(input.event())) || !STEPS.contains(step) || !FIELDS.contains(field) || !VALUES.contains(value) || !Set.of("", "required", "invalid").contains(code) || (!code.isEmpty() && !value.isEmpty())) throw new BadRequestException("Invalid metric.");
        if (!code.isEmpty()) value = code;
        increment(input.event(), step, field, value);
    }
    @Transactional
    public void paid() { increment("buy_paid", "", "", ""); }
    private void increment(String event, String step, String field, String value) {
        // Reuse the existing database lock to serialize creation and increments across instances.
        calendar.lockSchedule();
        LocalDate date = LocalDate.now(clock);
        BuyMetric metric = repository.findByDateAndEventAndStepAndFieldAndValue(date, event, step, field, value).orElseGet(BuyMetric::new);
        metric.setDate(date); metric.setEvent(event); metric.setStep(step); metric.setField(field); metric.setValue(value); metric.setCount(metric.getCount() + 1);
        repository.save(metric);
    }
    @Transactional(readOnly = true)
    public List<BuyMetric> list(LocalDate from, LocalDate to) {
        if (from.isAfter(to)) throw new BadRequestException("Invalid date range.");
        return repository.findByDateBetweenOrderByDateAsc(from, to);
    }
}
