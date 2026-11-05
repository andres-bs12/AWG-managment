package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * E-mail left on the closed shop to hear when orders open next season. Double opt-in: the entry only
 * counts once the address owner opened the confirmation link; unconfirmed entries are deleted after a week.
 */
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

    /** Secret for the confirmation and unsubscribe links. */
    @Column(nullable = false, unique = true, length = 64)
    private String token;

    private Instant confirmedAt;
}
