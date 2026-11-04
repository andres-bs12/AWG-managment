package com.artwithgab.awg_tracking.dto.market;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Mirrors `SaveMarketInput`. Business rules are checked in MarketService so messages match the mock. */
public record SaveMarketRequest(
        UUID id,
        @Size(max = 120) String name,
        LocalDate startDate,
        LocalDate finishDate,
        BigDecimal totalCost,
        Integer stall,
        @NotNull @Valid @Size(max = 200) List<SaveMarketDayRequest> days
) {
}
