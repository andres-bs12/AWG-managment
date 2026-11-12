package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.market.MarketDayDto;
import com.artwithgab.awg_tracking.dto.market.MarketDto;
import com.artwithgab.awg_tracking.dto.market.SaveMarketRequest;
import com.artwithgab.awg_tracking.dto.market.SaveMarketResponse;
import com.artwithgab.awg_tracking.service.MarketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MarketController {
    private final MarketService marketService;

    @GetMapping("/markets")
    public List<MarketDto> listMarkets() {
        return marketService.listMarkets();
    }

    @GetMapping("/market-days")
    public List<MarketDayDto> listMarketDays(@RequestParam(required = false) UUID marketId) {
        return marketService.listMarketDays(marketId);
    }

    @PostMapping("/markets")
    public SaveMarketResponse saveMarket(@Valid @RequestBody SaveMarketRequest body) {
        return marketService.saveMarket(body);
    }

    @DeleteMapping("/markets/{id}")
    public ResponseEntity<Void> deleteMarket(@PathVariable UUID id) {
        marketService.deleteMarket(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/market-days/{id}")
    public ResponseEntity<Void> deleteMarketDay(@PathVariable UUID id) {
        marketService.deleteMarketDay(id);
        return ResponseEntity.noContent().build();
    }
}
