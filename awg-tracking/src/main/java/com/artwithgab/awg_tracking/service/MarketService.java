package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.market.*;
import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.Market;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.MarketDayRepository;
import com.artwithgab.awg_tracking.repository.MarketRepository;
import com.artwithgab.awg_tracking.repository.OrderItemRepository;
import com.artwithgab.awg_tracking.support.CalendarRules;
import com.artwithgab.awg_tracking.support.Hours;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/** Markets and their days. Port of saveMarket / deleteMarket / deleteMarketDay from the mock store. */
@Service
@RequiredArgsConstructor
public class MarketService {
    private final MarketRepository marketRepository;
    private final MarketDayRepository marketDayRepository;
    private final OrderItemRepository orderItemRepository;
    private final CalendarService calendarService;
    private final HomeDayService homeDayService;
    private final ViewMapper mapper;

    @Transactional(readOnly = true)
    public List<MarketDto> listMarkets() {
        return marketRepository.findAllByOrderByNameAsc().stream().map(mapper::market).toList();
    }

    @Transactional(readOnly = true)
    public List<MarketDayDto> listMarketDays(UUID marketId) {
        LocalDate today = calendarService.snapshot().today();
        List<MarketDay> days = marketId == null ? marketDayRepository.findAllWithMarket() : marketDayRepository.findByMarketIdWithMarket(marketId);
        return days.stream().map(d -> mapper.marketDay(d, today)).toList();
    }

    @Transactional
    public SaveMarketResponse saveMarket(SaveMarketRequest input) {
        calendarService.lockSchedule();
        String name = input.name() == null ? "" : input.name().trim();
        if (name.isEmpty()) throw new BadRequestException("Name is required");
        if (input.startDate() == null || input.finishDate() == null) throw new BadRequestException("Season start and end are required");
        if (input.finishDate().isBefore(input.startDate())) throw new BadRequestException("Season end must be on or after the start");
        if (input.totalCost() == null || input.totalCost().signum() < 0) throw new BadRequestException("Season cost must be zero or more");
        if (input.stall() == null || input.stall() < 1) throw new BadRequestException("Stall number must be a whole number of 1 or more");

        Set<LocalDate> allowed = new HashSet<>(CalendarRules.marketPickupDates(input.startDate(), input.finishDate()));
        if (allowed.isEmpty()) throw new BadRequestException("No Friday, Saturday, or Sunday in this range");

        Map<LocalDate, SaveMarketDayRequest> wanted = new LinkedHashMap<>();
        for (SaveMarketDayRequest day : input.days()) {
            String label = CalendarRules.label(day.date());
            if (wanted.containsKey(day.date())) throw new BadRequestException(label + " is listed twice");
            if (!allowed.contains(day.date())) throw new BadRequestException(label + " is not a Friday, Saturday, or Sunday in this season");
            if (!Double.isFinite(day.openHour()) || !Double.isFinite(day.closeHour()) || !(day.closeHour() > day.openHour())
                    || day.openHour() < 0 || day.closeHour() >= 24) {
                throw new BadRequestException(label + ": close must be after open");
            }
            wanted.put(day.date(), day);
        }

        Market existing = null;
        if (input.id() != null) {
            existing = marketRepository.findById(input.id()).filter(m -> m.getKind() == MarketKind.MARKET)
                    .orElseThrow(() -> new ResourceNotFoundException("Market not found"));
        }
        List<MarketDay> allDays = marketDayRepository.findAllWithMarket();
        for (LocalDate date : wanted.keySet()) {
            Market owner = existing;
            Optional<MarketDay> other = allDays.stream()
                    .filter(d -> d.getDate().equals(date) && d.getMarket().getKind() == MarketKind.MARKET)
                    .filter(d -> owner == null || !d.getMarket().getId().equals(owner.getId()))
                    .findFirst();
            if (other.isPresent()) {
                throw new BadRequestException(CalendarRules.label(date) + " already belongs to " + other.get().getMarket().getName());
            }
        }

        List<OrderItem> items = orderItemRepository.findAllWithOrder();
        if (existing != null) {
            for (MarketDay day : existing.getMarketDays()) {
                if (!wanted.containsKey(day.getDate()) && dayIsUsed(day.getDate(), items)) {
                    throw new BadRequestException(CalendarRules.label(day.getDate()) + " has orders and cannot leave the season");
                }
            }
        }
        // A stall day takes over its date (also from a home day), so every booking on it must fit.
        for (SaveMarketDayRequest row : wanted.values()) {
            String conflict = hoursConflict(row.date(), row.openHour(), row.closeHour(), items);
            if (conflict != null) throw new BadRequestException(conflict);
        }

        Market market = existing != null ? existing : new Market();
        market.setKind(MarketKind.MARKET);
        market.setName(name);
        market.setTotalCost(input.totalCost().setScale(2, java.math.RoundingMode.HALF_UP));
        market.setStartDate(input.startDate());
        market.setFinishDate(input.finishDate());
        market.setStall(input.stall());
        market.getMarketDays().removeIf(d -> !wanted.containsKey(d.getDate()));
        for (SaveMarketDayRequest row : wanted.values()) {
            MarketDay day = market.getMarketDays().stream().filter(d -> d.getDate().equals(row.date())).findFirst().orElse(null);
            if (day == null) {
                day = new MarketDay();
                day.setMarket(market);
                day.setDate(row.date());
                market.getMarketDays().add(day);
            }
            day.setOpenTime(Hours.toTime(row.openHour()));
            day.setCloseTime(Hours.toTime(row.closeHour()));
        }
        market.getMarketDays().sort(Comparator.comparing(MarketDay::getDate));
        Market saved = marketRepository.saveAndFlush(market);
        homeDayService.sync();

        LocalDate today = calendarService.snapshot().today();
        return new SaveMarketResponse(mapper.market(saved), saved.getMarketDays().stream().map(d -> mapper.marketDay(d, today)).toList());
    }

    @Transactional
    public void deleteMarketDay(UUID id) {
        calendarService.lockSchedule();
        MarketDay day = marketDayRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Market day not found"));
        Market market = day.getMarket();
        if (market.getKind() != MarketKind.MARKET) throw new BadRequestException("This day cannot be deleted here");
        if (dayIsUsed(day.getDate(), orderItemRepository.findAllWithOrder())) {
            throw new BadRequestException(CalendarRules.label(day.getDate()) + " has orders and cannot be deleted");
        }
        market.getMarketDays().remove(day);
        marketRepository.saveAndFlush(market);
        homeDayService.sync();
    }

    @Transactional
    public void deleteMarket(UUID id) {
        calendarService.lockSchedule();
        Market market = marketRepository.findById(id).filter(m -> m.getKind() == MarketKind.MARKET)
                .orElseThrow(() -> new ResourceNotFoundException("Market not found"));
        List<OrderItem> items = orderItemRepository.findAllWithOrder();
        for (MarketDay day : market.getMarketDays()) {
            if (dayIsUsed(day.getDate(), items)) {
                throw new BadRequestException(CalendarRules.label(day.getDate()) + " has orders. This market cannot be deleted");
            }
        }
        marketRepository.delete(market);
        marketRepository.flush();
        homeDayService.sync();
    }

    /** A date is in use when an ornament is painted or handed off on it. */
    static boolean dayIsUsed(LocalDate date, List<OrderItem> items) {
        return items.stream().anyMatch(i -> date.equals(i.getHandoffDate())
                || (i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(date)));
    }

    private static String hoursConflict(LocalDate date, double open, double close, List<OrderItem> items) {
        String label = CalendarRules.label(date);
        String span = Hours.format(open) + "–" + Hours.format(close);
        for (OrderItem i : items) {
            if (i.getPaintStart() != null && i.getPaintStart().toLocalDate().equals(date)) {
                double s = Hours.of(i.getPaintStart().toLocalTime());
                double e = Hours.of(i.getPaintEnd().toLocalTime());
                if (s < open - Hours.EPS || e > close + Hours.EPS) return label + ": a paint session sits outside " + span;
            }
        }
        for (OrderItem i : items) {
            if (date.equals(i.getHandoffDate()) && i.getPickUpTime() != null) {
                double h = Hours.of(i.getPickUpTime());
                if (h < open - Hours.EPS || h >= close) return label + ": a pickup at " + Hours.format(h) + " sits outside " + span;
            }
        }
        return null;
    }

}
