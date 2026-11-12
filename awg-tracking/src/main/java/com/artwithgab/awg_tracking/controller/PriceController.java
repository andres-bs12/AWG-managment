package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.pricing.PricesDto;
import com.artwithgab.awg_tracking.dto.pricing.UpdatePricesRequest;
import com.artwithgab.awg_tracking.service.PricingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** Staff price editor (Stock screen). Public pages read prices from /api/shop/config. */
@RestController
@RequestMapping("/api/prices")
@RequiredArgsConstructor
public class PriceController {
    private final PricingService pricingService;

    @GetMapping
    public PricesDto get() {
        return pricingService.current();
    }

    @PutMapping
    public PricesDto update(@Valid @RequestBody UpdatePricesRequest body) {
        return pricingService.update(body);
    }
}
