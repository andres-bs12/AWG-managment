package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findOrderByTrackToken(String token);

    Optional<Order> findOrderByCode(String code);

    Optional<Order> findOrderByFormToken(String formToken);

    boolean existsByCode(String code);

}
