package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.dto.pricing.PricesDto;
import com.artwithgab.awg_tracking.dto.shop.PostCollectionDayDto;
import com.artwithgab.awg_tracking.dto.shop.ShippingWindowDto;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.model.PostCollectionDay;
import com.artwithgab.awg_tracking.repository.PostCollectionDayRepository;
import com.artwithgab.awg_tracking.support.AustrianHolidays;
import com.artwithgab.awg_tracking.support.PostShipping;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShippingService {
    private final AwgProperties props;
    private final PricingService pricing;
    private final CalendarService calendarService;
    private final PostCollectionDayRepository overrides;
    private final Clock clock;

    PostShipping calendar(PricesDto prices) {
        var config = props.post();
        LocalDate seasonEnd = props.shop().seasonEnd() == null ? LocalDate.of(2026, 12, 24) : props.shop().seasonEnd();
        LocalDate lastArrival = config.lastArrival() == null ? seasonEnd.minusDays(1) : config.lastArrival();
        var weekdays = prices.postCollectionDays().stream()
                .map(day -> DayOfWeek.valueOf(day.toUpperCase(Locale.ROOT)))
                .collect(Collectors.toSet());
        var byDate = overrides.findAll().stream()
                .collect(Collectors.toMap(PostCollectionDay::getDate, PostCollectionDay::isOpen));
        return new PostShipping(weekdays, props.shop().deliveriesFrom(), config.transitMinDays(),
                config.transitMaxDays(), lastArrival, byDate);
    }

    @Transactional(readOnly = true)
    public ShippingWindowDto window(LocalDate readyOn) {
        LocalDate today = LocalDate.now(clock);
        return ShippingWindowDto.from(calendar(pricing.current()).windowAfter(readyOn.isBefore(today) ? today : readyOn));
    }

    @Transactional
    public List<PostCollectionDayDto> collectionDays(LocalDate from, LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) >= 400) {
            throw new BadRequestException("Choose a collection date range of at most 400 days.").code("VALIDATION");
        }
        calendarService.lockSchedule();
        var calendar = calendar(pricing.current());
        return from.datesUntil(to.plusDays(1))
                .map(date -> new PostCollectionDayDto(date, calendar.isCollectionOn(date), calendar.overrides().get(date)))
                .filter(day -> day.open() || day.override() != null)
                .toList();
    }

    @Transactional
    public void setCollectionDay(LocalDate date, Boolean open) {
        if (Boolean.TRUE.equals(open) && !AustrianHolidays.isWorkingDay(date)) {
            throw new BadRequestException("Post collections must be on a working day.").code("VALIDATION").field("open");
        }
        calendarService.lockSchedule();
        if (open == null) {
            overrides.deleteById(date);
        } else {
            overrides.save(new PostCollectionDay(date, open));
        }
    }
}
