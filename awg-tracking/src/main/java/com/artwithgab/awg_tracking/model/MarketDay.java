package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** One opening day of a market (or one home painting day) with its hours, in Vienna wall-clock time. */
@Entity
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_market_day_market_date", columnNames = {"market_id", "date"}))
@Getter
@Setter
@NoArgsConstructor
public class MarketDay {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JoinColumn(name = "market_id", nullable = false)
    @ManyToOne(fetch = FetchType.LAZY)
    private Market market;

    @Column(nullable = false)
    private LocalDate date;
    @Column(nullable = false)
    private LocalTime openTime;
    @Column(nullable = false)
    private LocalTime closeTime;
}
