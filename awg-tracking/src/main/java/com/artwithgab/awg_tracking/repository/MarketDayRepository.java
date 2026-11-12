package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.MarketDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MarketDayRepository extends JpaRepository<MarketDay, UUID> {

    @Query("select d from MarketDay d join fetch d.market order by d.date asc, d.id asc")
    List<MarketDay> findAllWithMarket();

    @Query("select d from MarketDay d join fetch d.market where d.market.id = :marketId order by d.date asc")
    List<MarketDay> findByMarketIdWithMarket(UUID marketId);
}
