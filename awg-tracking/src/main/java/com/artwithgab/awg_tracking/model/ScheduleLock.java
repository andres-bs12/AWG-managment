package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Coordination rows locked with SELECT ... FOR UPDATE. Schedule and anonymous metrics use
 * separate rows so public telemetry cannot hold up painting reservations.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class ScheduleLock {
    public static final long ID = 1L;
    public static final long METRICS_ID = 2L;

    @Id
    private Long id;
}
