package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    boolean existsBySoldOnDayOrHandoffDay(MarketDay soldOnDay, MarketDay handoffDay);

    interface MarketSale {
        String getMarketOrnamentId();
        UUID getOrderId();
        String getOrderCode();
    }

    @Query("select i.marketOrnament.id as marketOrnamentId, o.id as orderId, o.code as orderCode " +
            "from OrderItem i join i.order o where i.marketOrnament is not null and o.status <> 'CANCELLED'")
    List<MarketSale> activeMarketSales();

    /** Every item with its order and customer. The data set is one season of a small stall. */
    @Query("select i from OrderItem i join fetch i.order o join fetch o.customer where o.status <> 'CANCELLED'")
    List<OrderItem> findAllWithOrder();
}
