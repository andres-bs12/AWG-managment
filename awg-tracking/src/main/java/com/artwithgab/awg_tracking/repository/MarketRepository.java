package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.Market;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MarketRepository extends JpaRepository<Market, UUID> {
}
