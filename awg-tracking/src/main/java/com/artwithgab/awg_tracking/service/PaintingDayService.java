package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.agenda.PaintingDayDto;
import com.artwithgab.awg_tracking.dto.agenda.UpdatePaintingDayRequest;
import com.artwithgab.awg_tracking.model.Market;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.model.PaintingDay;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/** Gaby's per-day painting hours, switch and limit, independent from market pickup hours. */
@Service
@RequiredArgsConstructor
public class PaintingDayService {
    private final AgendaService agendaService;
    private final CalendarService calendarService;
    private final com.artwithgab.awg_tracking.repository.PaintingDayRepository repository;

    @Transactional(readOnly = true)
    public List<PaintingDayDto> list(LocalDate from, LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > 62) {
            throw new BadRequestException("Choose a range of up to 62 days.");
        }
        AgendaService.Snapshot s = agendaService.snapshot();
        List<PaintingDayDto> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) out.add(view(s, d));
        return out;
    }

    @Transactional
    public PaintingDayDto update(LocalDate date, UpdatePaintingDayRequest input) {
        validateHours(input.getOpenHour(), input.getCloseHour());
        calendarService.lockSchedule();
        PaintingDay day = repository.findById(date).orElseGet(() -> {
            PaintingDay created = new PaintingDay();
            created.setDate(date);
            return created;
        });
        if (input.getOpen() != null) day.setOpen(input.getOpen());
        AgendaService.Snapshot current = agendaService.snapshot();
        if (input.isPaintingMarketSpecified()) {
            var marketId = input.getPaintingMarketId();
            Market market = marketId == null ? null : current.index().marketDaysOn(date).stream()
                    .map(MarketDay::getMarket).filter(m -> m.getId().equals(marketId)).findFirst()
                    .orElseThrow(() -> new BadRequestException("Choose a market open on this date.")
                            .code("VALIDATION").field("paintingMarketId"));
            var previous = current.paintingMarketDay(date).map(d -> d.getMarket().getId()).orElse(null);
            var next = current.index().paintingDayOn(date, marketId, current.primaryPickupMarketId())
                    .map(d -> d.getMarket().getId()).orElse(null);
            AgendaService.assertPaintingLocationChange(current.index(), current.items(), date, previous, next);
            day.setPaintingMarket(market);
        }
        // Switch-only requests retain the owner's previously chosen hours.
        if (input.getOpenHour() != null) {
            day.setOpenHour(input.getOpenHour());
            day.setCloseHour(input.getCloseHour());
        }
        double[] effectiveHours = AgendaService.effectivePaintingHours(date, day,
                current.index().marketDaysOn(date), current.index().dayByDate(date), current.primaryPickupMarketId());
        day.setMaxPaintings(AgendaService.maxPaintingsFromHours(effectiveHours[0], effectiveHours[1]));
        repository.saveAndFlush(day);
        return view(agendaService.snapshot(), date);
    }

    private static PaintingDayDto view(AgendaService.Snapshot s, LocalDate d) {
        Market market = s.paintingMarket(d);
        return new PaintingDayDto(d.toString(), s.paintingOpen(d), s.maxPaintings(d), s.paintingsOn(d, null),
                s.paintingOpenHour(d), s.paintingCloseHour(d),
                market == null ? null : market.getId().toString(), market == null ? null : market.getName());
    }

    private static void validateHours(Double open, Double close) {
        if (open == null && close == null) return;
        if (open == null || close == null || !validHour(open) || !validHour(close) || open >= close) {
            throw new BadRequestException("Choose both painting hours from 00:00 to 23:45 in 15-minute steps, with the end after the start.");
        }
    }

    private static boolean validHour(double hour) {
        return Double.isFinite(hour) && hour >= 0 && hour < 24
                && hour * 4 == Math.rint(hour * 4); // exact, like the V11 CHECK constraint
    }
}
