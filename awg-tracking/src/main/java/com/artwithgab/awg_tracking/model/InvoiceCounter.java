package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Transactional counter: rolled-back documents do not consume a number. */
@Entity
@Getter
@Setter
public class InvoiceCounter {
    public static final long ID = 1L;
    @Id private Long id = ID;
    @Column(nullable = false) private long lastNumber;
}
