package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.InvoiceCounter;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.Optional;

public interface InvoiceCounterRepository extends JpaRepository<InvoiceCounter, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from InvoiceCounter c where c.id = 1")
    Optional<InvoiceCounter> lockCounter();
}
