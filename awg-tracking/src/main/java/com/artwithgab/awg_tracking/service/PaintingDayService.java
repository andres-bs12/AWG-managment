package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.agenda.PaintingDayDto;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.model.PaintingDay;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/** Gaby's per-day painting switch and limit (default: open, awg.calendar.default-max-paintings). */
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
    public PaintingDayDto update(LocalDate date, boolean open, int maxPaintings) {
        calendarService.lockSchedule();
        PaintingDay day = repository.findById(date).orElseGet(() -> {
            PaintingDay created = new PaintingDay();
            created.setDate(date);
            return created;
        });
        day.setOpen(open);
        day.setMaxPaintings(maxPaintings);
        repository.saveAndFlush(day);
        return view(agendaService.snapshot(), date);
    }

    private static PaintingDayDto view(AgendaService.Snapshot s, LocalDate d) {
        return new PaintingDayDto(d.toString(), s.paintingOpen(d), s.maxPaintings(d), s.paintingsOn(d, null));
    }
}
