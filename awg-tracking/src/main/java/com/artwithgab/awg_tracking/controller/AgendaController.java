package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.agenda.*;
import com.artwithgab.awg_tracking.service.AgendaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/agenda")
@RequiredArgsConstructor
public class AgendaController {
    private final AgendaService agendaService;

    @GetMapping("/days")
    public List<AgendaDayDto> listDays() {
        return agendaService.listDays();
    }

    @GetMapping("/days/{date}")
    public AgendaDayDto getDay(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return agendaService.getDay(date);
    }

    @PatchMapping("/blocks/{blockId}")
    public ResponseEntity<Void> moveBlock(@PathVariable UUID blockId, @Valid @RequestBody MoveBlockRequest body) {
        agendaService.moveBlock(blockId, body.date(), body.startHour());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/capacity")
    public CapacityResultDto checkCapacity(@Valid @RequestBody CapacityRequest body) {
        return agendaService.checkCapacity(body);
    }

    /** 204 when there is no suggestion. */
    @PostMapping("/move-suggestion")
    public ResponseEntity<MoveSuggestionDto> moveSuggestion(@Valid @RequestBody MoveSuggestionRequest body) {
        MoveSuggestionDto suggestion = agendaService.findMoveSuggestion(body);
        return suggestion == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(suggestion);
    }
}
