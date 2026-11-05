package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.WaitlistEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface WaitlistRepository extends JpaRepository<WaitlistEntry, UUID> {
    boolean existsByEmail(String email);
}
