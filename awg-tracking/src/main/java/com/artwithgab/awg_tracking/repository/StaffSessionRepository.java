package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.StaffSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface StaffSessionRepository extends JpaRepository<StaffSession, UUID> {
    Optional<StaffSession> findByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from StaffSession s where s.expiresAt < :now")
    int deleteExpired(Instant now);

    @Modifying
    @Query("delete from StaffSession s where s.staffUser.id = :userId and s.tokenHash <> :keepHash")
    int deleteOtherSessions(java.util.UUID userId, String keepHash);

    @Modifying
    @Query("delete from StaffSession s where s.tokenHash = :tokenHash")
    int deleteByTokenHash(String tokenHash);
}
