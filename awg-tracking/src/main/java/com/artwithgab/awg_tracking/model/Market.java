package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.MarketKind;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** A market stall (season, stall number, cost) or the single HOME row used for painting at home. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Market {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MarketKind kind = MarketKind.MARKET;

    @Column(nullable = false)
    private String name;

    /** Season bounds. Null for HOME. */
    private LocalDate startDate;
    private LocalDate finishDate;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalCost = BigDecimal.ZERO;

    /** Stall number. Null for HOME. */
    private Integer stall;

    @OneToMany(mappedBy = "market", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("date ASC")
    private List<MarketDay> marketDays = new ArrayList<>();
}
