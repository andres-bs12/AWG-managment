package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.stats.StatsDto;
import com.artwithgab.awg_tracking.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/** Staff Statistics (sales and anonymous web counts). Staff-only like every other /api route. */
@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {
    private final StatsService statsService;

    @GetMapping
    public StatsDto stats(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return statsService.stats(from, to);
    }
}
