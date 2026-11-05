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

    List<Order> findByHandedOverAtBeforeAndAnonymizedAtIsNull(java.time.Instant cutoff);

    /** Not handed over, not erased, and no item's handoff date on or after {@code day}. */
    @Query("select o from Order o where o.handedOver = false and o.anonymizedAt is null and not exists "
            + "(select i from OrderItem i where i.order = o and i.handoffDate >= :day)")
    List<Order> findStaleUnhandedBefore(@org.springframework.data.repository.query.Param("day") java.time.LocalDate day);

    List<Order> findByCustomerId(UUID customerId);

    boolean existsByCustomerId(UUID customerId);

    Optional<Order> findByIdempotencyKey(String idempotencyKey);

    long countByCheckoutStatus(com.artwithgab.awg_tracking.enums.CheckoutStatus status);

    boolean existsByCode(String code);

    /** Web orders still waiting for Stripe after their checkout expired. */
    List<Order> findByCheckoutStatusAndCheckoutExpiresAtBefore(CheckoutStatus status, Instant before);

    Optional<Order> findByStripeSessionId(String sessionId);
}
