package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.MarketDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MarketDayRepository extends JpaRepository<MarketDay, UUID> {
}
