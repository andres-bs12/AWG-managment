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

    /** Staff search by code, customer name or phone digits (newest first). */
    @Query("select o from Order o join fetch o.customer c where o.anonymizedAt is null and ("
            + "upper(o.code) like upper(concat('%', :q, '%')) or upper(c.name) like upper(concat('%', :q, '%'))"
            + " or replace(replace(replace(c.phone, ' ', ''), '-', ''), '/', '') like concat('%', :digits, '%')) order by o.createdAt desc")
    List<Order> search(@org.springframework.data.repository.query.Param("q") String q,
                       @org.springframework.data.repository.query.Param("digits") String digits,
                       org.springframework.data.domain.Pageable page);

    @Query("select o from Order o join fetch o.customer where o.checkoutStatus in :statuses order by o.createdAt desc")
    List<Order> findByCheckoutStatusIn(@org.springframework.data.repository.query.Param("statuses") java.util.Collection<CheckoutStatus> statuses);
}
