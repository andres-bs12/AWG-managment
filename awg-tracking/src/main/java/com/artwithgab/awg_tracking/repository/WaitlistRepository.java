package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.WaitlistEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface WaitlistRepository extends JpaRepository<WaitlistEntry, UUID> {
    boolean existsByEmail(String email);

    Optional<WaitlistEntry> findByEmail(String email);

    Optional<WaitlistEntry> findByToken(String token);

    long deleteByConfirmedAtIsNullAndCreatedAtBefore(Instant cutoff);
}
