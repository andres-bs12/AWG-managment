package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.model.Market;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.MarketDayRepository;
import com.artwithgab.awg_tracking.repository.MarketRepository;
import com.artwithgab.awg_tracking.repository.OrderItemRepository;
import com.artwithgab.awg_tracking.support.CalendarRules;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Keeps the home painting days ("Casa") in sync with the rules in docs/README.md:
 * Mon/Tue/Thu 10–13, Wed/Fri 10–12, and when a stall is open that day the stall wins
 * (unused home days on stall dates are removed).
 */
@Service
@RequiredArgsConstructor
public class HomeDayService {
    public static final String HOME_NAME = "Casa";

    private final MarketRepository marketRepository;
    private final MarketDayRepository marketDayRepository;
    private final OrderItemRepository orderItemRepository;
    private final AwgProperties props;
    private final Clock clock;
    private final com.artwithgab.awg_tracking.repository.ScheduleLockRepository scheduleLockRepository;

    @Transactional
    public Market ensureHomeMarket() {
        return marketRepository.findFirstByKind(MarketKind.HOME).orElseGet(() -> {
            Market home = new Market();
            home.setKind(MarketKind.HOME);
            home.setName(HOME_NAME);
            home.setTotalCost(BigDecimal.ZERO);
            return marketRepository.save(home);
        });
    }

    /** Keeps the home-day horizon moving forward while the server runs for weeks. */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 15 3 * * *", zone = "Europe/Vienna")
    @Transactional
    public void syncDaily() {
        if (scheduleLockRepository.lockById(com.artwithgab.awg_tracking.model.ScheduleLock.ID).isEmpty()) return;
        doSync();
    }

    @Transactional
    public void sync() {
        doSync();
    }

    private void doSync() {
        Market home = ensureHomeMarket();
        LocalDate today = LocalDate.now(clock);
        List<MarketDay> all = marketDayRepository.findAllWithMarket();
        Set<LocalDate> stallDates = all.stream().filter(d -> d.getMarket().getKind() == MarketKind.MARKET)
                .map(MarketDay::getDate).collect(Collectors.toSet());
        LocalDate lastStall = stallDates.stream().max(LocalDate::compareTo).orElse(today);
        LocalDate horizon = today.plusDays(props.calendar().homeDaysAhead());
        if (lastStall.isAfter(horizon)) horizon = lastStall;
        List<OrderItem> items = orderItemRepository.findAllWithOrder();

        // Remove unused future home days on stall dates.
        home.getMarketDays().removeIf(d -> !d.getDate().isBefore(today) && stallDates.contains(d.getDate())
                && !MarketService.dayIsUsed(d.getDate(), items));

        Set<LocalDate> homeDates = home.getMarketDays().stream().map(MarketDay::getDate).collect(Collectors.toSet());
        for (LocalDate d = today; !d.isAfter(horizon); d = d.plusDays(1)) {
            LocalTime[] hours = CalendarRules.homePaintHours(d);
            if (hours == null || stallDates.contains(d) || homeDates.contains(d)) continue;
            MarketDay day = new MarketDay();
            day.setMarket(home);
            day.setDate(d);
            day.setOpenTime(hours[0]);
            day.setCloseTime(hours[1]);
            home.getMarketDays().add(day);
        }
        marketRepository.saveAndFlush(home);
    }
}
