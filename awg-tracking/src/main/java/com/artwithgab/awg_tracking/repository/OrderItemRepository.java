package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    /** Every item with its order and customer. The data set is one season of a small stall. */
    @Query("select i from OrderItem i join fetch i.order o join fetch o.customer")
    List<OrderItem> findAllWithOrder();

    boolean existsByHandoffDate(LocalDate date);

    @Query("select count(i) > 0 from OrderItem i where i.paintStart >= :from and i.paintStart < :to")
    boolean existsPaintBetween(java.time.LocalDateTime from, java.time.LocalDateTime to);
}
