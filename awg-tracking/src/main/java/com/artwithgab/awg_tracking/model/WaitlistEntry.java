package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** E-mail left on the closed shop to hear when orders open next season. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class WaitlistEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 200)
    private String email;

    @Column(nullable = false, length = 2)
    private String locale;

    @Column(nullable = false)
    private Instant createdAt;
}
