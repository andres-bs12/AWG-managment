package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.agenda.PaintingDayDto;
import com.artwithgab.awg_tracking.dto.agenda.UpdatePaintingDayRequest;
import com.artwithgab.awg_tracking.service.PaintingDayService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Staff: which days take paintings and how many (see docs/sprint4-contract.md). */
@RestController
@RequestMapping("/api/painting-days")
@RequiredArgsConstructor
public class PaintingDayController {
    private final PaintingDayService service;

    @GetMapping
    public List<PaintingDayDto> list(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(from, to);
    }

    @PatchMapping("/{date}")
    public PaintingDayDto update(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                 @Valid @RequestBody UpdatePaintingDayRequest body) {
        return service.update(date, body.open(), body.maxPaintings(), body.openHour(), body.closeHour());
    }
}
