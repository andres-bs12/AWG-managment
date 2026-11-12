package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** The one row of staff-edited prices (id 1). Absent until staff first save prices. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class PriceSetting {
    public static final long ID = 1L;

    @Id
    private Long id;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal customPrice;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal finishedPrice;
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal nameExtra;
    /** Bumped on every save; the screen sends the revision it showed to detect concurrent edits. */
    @Column(nullable = false)
    private long revision;
    @Column(nullable = false)
    private Instant updatedAt;
}
