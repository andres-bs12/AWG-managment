package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class Market {
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private UUID id;

        private Instant startDate;
        private Instant finishDate;
        private Double totalCost;

        @JoinColumn(name = "market_day_id")
        @OneToMany
        private List<LocalDate> marketDays;
        private Integer staul;
}
