package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.ScheduleLock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ScheduleLockRepository extends JpaRepository<ScheduleLock, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ScheduleLock l where l.id = :id")
    Optional<ScheduleLock> lockById(Long id);
}
