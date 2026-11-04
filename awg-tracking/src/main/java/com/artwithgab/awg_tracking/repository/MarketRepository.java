package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.model.Market;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MarketRepository extends JpaRepository<Market, UUID> {
    Optional<Market> findFirstByKind(MarketKind kind);

    List<Market> findAllByOrderByNameAsc();
}
