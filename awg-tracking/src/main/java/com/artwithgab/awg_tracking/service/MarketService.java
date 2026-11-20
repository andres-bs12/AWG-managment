package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.enums.DeliveryKind;

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
import com.artwithgab.awg_tracking.repository.PaintingDayRepository;
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
    private final PaintingDayRepository paintingDayRepository;
    private final HomeDayService homeDayService;
    private final ViewMapper mapper;
    private final com.artwithgab.awg_tracking.config.AwgProperties props;

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
            if (!allowed.contains(day.date())) throw new BadRequestException(label + " is not a Friday, Saturday, or Sunday in this season or an opening-week exception");
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
        CalendarIndex index = calendarService.snapshot();
        List<OrderItem> items = orderItemRepository.findAllWithOrder();
        Map<LocalDate, MarketDay> existingDays = new HashMap<>();
        if (existing != null) {
            for (MarketDay day : existing.getMarketDays()) {
                existingDays.put(day.getDate(), day);
                if (!wanted.containsKey(day.getDate())) {
                    assertDayCanBeRemoved(index, day, items, "has orders and cannot leave the season");
                }
            }
        }
        for (SaveMarketDayRequest row : wanted.values()) {
            MarketDay day = existingDays.get(row.date());
            List<MarketDay> stalls = index.marketDaysOn(row.date());
            List<MarketDay> postSaveStalls = postSaveStalls(stalls, existing, name, day, row);
            String conflict = paintingConflict(index, row.date(), postSaveStalls, items);
            if (conflict == null) conflict = pickupConflict(index, day, row, items);
            if (conflict != null) throw new BadRequestException(conflict);
            if (stalls.isEmpty() && hasViennaDeliveries(row.date(), items)) {
                throw new BadRequestException(CalendarRules.label(row.date()) + ": Vienna deliveries are booked that day; move them before adding a stall day")
                        .code("DAY_HAS_DELIVERIES").field("days");
            }
        }
        if (existing != null) {
            for (MarketDay day : existing.getMarketDays()) {
                if (!wanted.containsKey(day.getDate())) {
                    clearPaintingMarket(day);
                }
            }
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
            MarketDay day = existingDays.get(row.date());
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
        if (existing == null) marketRepository.save(market);
        marketRepository.flush();
        homeDayService.sync();

        LocalDate today = index.today();
        return new SaveMarketResponse(mapper.market(market), market.getMarketDays().stream().map(d -> mapper.marketDay(d, today)).toList());
    }

    @Transactional
    public void deleteMarketDay(UUID id) {
        calendarService.lockSchedule();
        MarketDay day = marketDayRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Market day not found"));
        Market market = day.getMarket();
        if (market.getKind() != MarketKind.MARKET) throw new BadRequestException("This day cannot be deleted here");
        assertDayCanBeRemoved(calendarService.snapshot(), day, orderItemRepository.findAllWithOrder(), "has orders and cannot be deleted");
        clearPaintingMarket(day);
        market.getMarketDays().remove(day);
        marketRepository.flush();
        homeDayService.sync();
    }

    @Transactional
    public void deleteMarket(UUID id) {
        calendarService.lockSchedule();
        Market market = marketRepository.findById(id).filter(m -> m.getKind() == MarketKind.MARKET)
                .orElseThrow(() -> new ResourceNotFoundException("Market not found"));
        List<OrderItem> items = orderItemRepository.findAllWithOrder();
        CalendarIndex index = calendarService.snapshot();
        for (MarketDay day : market.getMarketDays()) {
            assertDayCanBeRemoved(index, day, items, "has orders. This market cannot be deleted");
            clearPaintingMarket(day);
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

    private static boolean hasViennaDeliveries(LocalDate date, List<OrderItem> items) {
        return items.stream().anyMatch(i -> date.equals(i.getHandoffDate()) && i.getDeliveryKind() == DeliveryKind.DELIVERY);
    }

    private void assertDayCanBeRemoved(CalendarIndex index, MarketDay day, List<OrderItem> items, String message) {
        List<MarketDay> stalls = index.marketDaysOn(day.getDate());
        boolean lastStall = stalls.size() <= 1;
        if (orderItemRepository.existsBySoldOnDayOrHandoffDay(day, day)
                || items.stream().anyMatch(i -> pickupAt(i, index, day) || (lastStall && paintsOn(i, day.getDate())))) {
            throw new BadRequestException(CalendarRules.label(day.getDate()) + " " + message);
        }
        if (!lastStall) {
            List<MarketDay> remaining = stalls.stream().filter(d -> !d.getId().equals(day.getId())).toList();
            String conflict = paintingConflict(index, day.getDate(), remaining, items);
            if (conflict != null) throw new BadRequestException(conflict);
        }
    }

    private void clearPaintingMarket(MarketDay day) {
        paintingDayRepository.findById(day.getDate())
                .filter(rule -> rule.getPaintingMarket() != null
                        && rule.getPaintingMarket().getId().equals(day.getMarket().getId()))
                .ifPresent(rule -> rule.setPaintingMarket(null));
    }

    private static boolean pickupAt(OrderItem item, CalendarIndex index, MarketDay day) {
        return item.getDeliveryKind() == DeliveryKind.MARKET
                && index.pickupDay(item).map(pickup -> pickup.getId().equals(day.getId())).orElse(false);
    }

    private static boolean paintsOn(OrderItem item, LocalDate date) {
        return item.getPaintStart() != null && item.getPaintStart().toLocalDate().equals(date);
    }

    private static List<MarketDay> postSaveStalls(List<MarketDay> stalls, Market existing, String name,
                                                  MarketDay day, SaveMarketDayRequest row) {
        Market candidateMarket = new Market();
        candidateMarket.setId(existing != null ? existing.getId() : null);
        candidateMarket.setKind(MarketKind.MARKET);
        candidateMarket.setName(name);

        MarketDay candidateDay = new MarketDay();
        candidateDay.setId(day != null ? day.getId() : null);
        candidateDay.setMarket(candidateMarket);
        candidateDay.setDate(row.date());
        candidateDay.setOpenTime(Hours.toTime(row.openHour()));
        candidateDay.setCloseTime(Hours.toTime(row.closeHour()));

        List<MarketDay> out = new ArrayList<>();
        for (MarketDay stall : stalls) {
            if (day == null || !stall.getId().equals(day.getId())) out.add(stall);
        }
        out.add(candidateDay);
        return out;
    }

    private String paintingConflict(CalendarIndex index, LocalDate date, List<MarketDay> postChangeStalls, List<OrderItem> items) {
        var rule = paintingDayRepository.findById(date).orElse(null);
        double[] hours = AgendaService.effectivePaintingHours(date, rule, postChangeStalls,
                Optional.empty(), props.shop().primaryPickupMarketId());
        double open = hours[0];
        double close = hours[1];
        String label = CalendarRules.label(date);
        String span = Hours.format(open) + "–" + Hours.format(close);
        for (OrderItem i : items) {
            if (paintsOn(i, date)) {
                double s = Hours.of(i.getPaintStart().toLocalTime());
                double e = Hours.of(i.getPaintEnd().toLocalTime());
                if (s < open - Hours.EPS || e > close + Hours.EPS) return label + ": a paint session sits outside " + span;
            }
        }
        UUID override = rule == null || rule.getPaintingMarket() == null ? null : rule.getPaintingMarket().getId();
        UUID primary = props.shop().primaryPickupMarketId();
        UUID previous = CalendarIndex.effectivePaintingStall(index.marketDaysOn(date), override, primary)
                .map(day -> day.getMarket().getId()).orElse(null);
        UUID next = CalendarIndex.effectivePaintingStall(postChangeStalls, override, primary)
                .map(day -> day.getMarket().getId()).orElse(null);
        AgendaService.assertPaintingLocationChange(index, items, date, previous, next);
        return null;
    }

    private static String pickupConflict(CalendarIndex index, MarketDay day, SaveMarketDayRequest row,
                                         List<OrderItem> items) {
        if (day == null) return null;
        double open = row.openHour();
        double close = row.closeHour();
        String label = CalendarRules.label(row.date());
        String span = Hours.format(open) + "–" + Hours.format(close);
        for (OrderItem i : items) {
            if (i.getPickUpTime() != null && pickupAt(i, index, day)) {
                double h = Hours.of(i.getPickUpTime());
                boolean web = i.getOrder().getSource() == com.artwithgab.awg_tracking.enums.OrderSource.WEB;
                if (h < open - Hours.EPS || h >= close || (web && h > close - 0.5 + Hours.EPS)) {
                    return label + ": a pickup at " + Hours.format(h) + " sits outside " + span;
                }
            }
        }
        return null;
    }
}
