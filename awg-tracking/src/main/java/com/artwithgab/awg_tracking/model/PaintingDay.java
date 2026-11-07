package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Gaby's choice for one painting date. Missing row = open with the default limit
 * (awg.calendar.default-max-paintings), with hours inherited from the calendar.
 * Only automatic planning enforces the switch/limit; hours also constrain manual moves.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class PaintingDay {
    @Id
    private LocalDate date;

    @Column(nullable = false)
    private boolean open = true;

    @Column(nullable = false)
    private int maxPaintings;

    /** Nullable overrides keep the market's pickup hours independent of painting. */
    private Double openHour;

    private Double closeHour;
}
