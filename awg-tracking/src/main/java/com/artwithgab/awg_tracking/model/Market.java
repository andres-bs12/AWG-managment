package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class Market {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;
    private Boolean isHome;
    private String name;
    private Instant startDate;
    private Instant finishDate;
    private Double totalCost;
    private Integer stall;

    @OneToMany(mappedBy = "market", cascade = CascadeType.ALL)
    private List<MarketDay> marketDays = new ArrayList<>();
}
