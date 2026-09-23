package com.artwithgab.awg_tracking.model;

import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import org.springframework.data.annotation.Id;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MarketDay(
        String name,
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        UUID id,

        Instant openTime,
        Instant closeTime,
        Market market,
        LocalDate date
) {
}
