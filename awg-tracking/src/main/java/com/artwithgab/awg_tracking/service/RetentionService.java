package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.model.Customer;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.repository.StoredPhotoRepository;
import com.artwithgab.awg_tracking.repository.WaitlistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Data retention (GDPR storage limitation). Runs every night:
 * <ul>
 *   <li>Orders handed over more than {@code personalDataDays} ago, and orders never handed over whose
 *       last planned handoff day is more than {@code staleOrderDays} ago: photos are deleted, and the
 *       pet names, notes, back names, delivery address and (once no other order needs them) the
 *       customer's name, e-mail and phone are erased. Code, dates, items, colors, amounts and the
 *       Stripe session id stay for the accounting records and refunds.</li>
 *   <li>Unpaid or payment-review web orders are left to the checkout flow and the staff.</li>
 *   <li>Waitlist sign-ups never confirmed within {@code waitlistUnconfirmedDays} are deleted.</li>
 *   <li>Photo files without a database row (failed deletes) are removed.</li>
 * </ul>
 * Each order is erased in its own transaction, so one bad record does not block the others.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RetentionService {
    private final AwgProperties props;
    private final OrderRepository orderRepository;
    private final StoredPhotoRepository photoRepository;
    private final PhotoStorageService photoStorage;
    private final WaitlistRepository waitlistRepository;
    private final TransactionTemplate tx;
    private final Clock clock;

    @Scheduled(cron = "0 30 3 * * *", zone = "Europe/Vienna")
    public void run() {
        AwgProperties.Retention r = props.retention() == null ? new AwgProperties.Retention(0, 0, 0, 0) : props.retention();
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, ZoneId.of(props.zone()));

        List<UUID> due = tx.execute(s -> {
            Set<UUID> ids = new java.util.LinkedHashSet<>();
            orderRepository.findByHandedOverAtBeforeAndAnonymizedAtIsNull(now.minus(Duration.ofDays(r.personalDataDays())))
                    .forEach(o -> ids.add(o.getId()));
            orderRepository.findStaleUnhandedBefore(today.minusDays(r.staleOrderDays())).stream()
                    .filter(o -> o.isCancelled() || !o.isUnconfirmedWeb())
                    .forEach(o -> ids.add(o.getId()));
            return List.copyOf(ids);
        });
        int erased = 0;
        for (UUID id : due) {
            try {
                tx.executeWithoutResult(s -> orderRepository.findById(id).ifPresent(o -> anonymize(o, now)));
                erased++;
            } catch (RuntimeException e) {
                log.error("Retention: could not erase order {}; will retry next night", id, e);
            }
        }
        Long waitlist = tx.execute(s -> waitlistRepository.deleteByConfirmedAtIsNullAndCreatedAtBefore(now.minus(Duration.ofDays(r.waitlistUnconfirmedDays()))));
        int files = photoStorage.sweepOrphanFiles();
        if (erased > 0 || (waitlist != null && waitlist > 0) || files > 0) {
            log.info("Retention: erased {} orders, deleted {} unconfirmed waitlist sign-ups and {} orphan photo files", erased, waitlist, files);
        }
    }

    void anonymize(Order order, Instant now) {
        if (order.getAnonymizedAt() != null) return;
        for (OrderItem item : order.getOrderItems()) {
            Set<UUID> ids = new HashSet<>();
            item.getPhotos().forEach(p -> ids.add(p.getPhotoId()));
            if (!ids.isEmpty()) photoRepository.findByIdIn(ids).forEach(photoStorage::delete);
            item.getPhotos().clear();
            item.setPetName("");
            item.setNote("");
            if (item.getNameInOrnament() != null) item.setNameInOrnament("");
        }
        order.setDeliveryAddress(null);
        order.setCancellationReason(null);
        order.setCheckoutClientHash(null);
        // Caller-provided retry key; not needed once the sale is long done.
        order.setIdempotencyKey(null);
        // The form token stays (it reveals nothing now): the old link answers FORM_EXPIRED.
        order.setAnonymizedAt(now);

        Customer customer = order.getCustomer();
        boolean shared = customer != null && orderRepository.findByCustomerId(customer.getId()).stream()
                .anyMatch(other -> !other.getId().equals(order.getId()) && other.getAnonymizedAt() == null);
        if (customer != null && !shared) {
            customer.setName(Customer.DELETED_NAME);
            customer.setEmail("");
            customer.setPhone("");
        }
    }
}
