package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.enums.CheckoutStatus;
import com.artwithgab.awg_tracking.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    @Query("select o from Order o join fetch o.customer where upper(o.code) = upper(:code)")
    Optional<Order> findByCodeIgnoreCase(String code);

    @Query("select o from Order o join fetch o.customer where o.formToken = :formToken")
    Optional<Order> findByFormToken(String formToken);

    boolean existsByCustomerId(UUID customerId);

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    long countByCheckoutStatus(com.artwithgab.awg_tracking.enums.CheckoutStatus status);

    boolean existsByCode(String code);

    /** Web orders still waiting for Stripe after their checkout expired. */
    List<Order> findByCheckoutStatusAndCheckoutExpiresAtBefore(CheckoutStatus status, Instant before);

    Optional<Order> findByStripeSessionId(String sessionId);
}
