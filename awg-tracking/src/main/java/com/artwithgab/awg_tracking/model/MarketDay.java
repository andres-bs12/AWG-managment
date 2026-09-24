package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class MarketDay {
    private String name;
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @JoinColumn(name = "market_id", nullable = false)
    @ManyToOne
    private Market market;

    private LocalDate date;
    private LocalTime openTime;
    private LocalTime closeTime;

}
