package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Single-row table locked (SELECT ... FOR UPDATE) by every operation that books painting time,
 * so two iPads cannot book the same hour at once.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class ScheduleLock {
    public static final long ID = 1L;

    @Id
    private Long id;
}
