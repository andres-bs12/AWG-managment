package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.Invoice;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    List<Invoice> findByOrderIdOrderByNumberAsc(UUID orderId);
    Optional<Invoice> findByOrderIdAndStateKey(UUID orderId, String stateKey);
    Optional<Invoice> findFirstByOrderIdOrderByNumberDesc(UUID orderId);
    List<Invoice> findBySentAtIsNullAndRecipientNotAndAttemptsLessThanOrderByNumberAsc(String recipient, int attempts, Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.number = :number")
    Optional<Invoice> lockByNumber(Long number);
}
