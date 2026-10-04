package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {
}
