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
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Data retention (GDPR storage limitation). Runs every night:
 * <ul>
 *   <li>Orders handed over more than {@code personalDataDays} ago, and orders never handed over that
 *       are older than {@code staleOrderDays}: photos are deleted, and the customer's name, e-mail,
 *       phone, delivery address, pet names, notes and back names are erased. Code, dates, items, colors
 *       and amounts stay for the accounting records.</li>
 *   <li>Waitlist sign-ups never confirmed within {@code waitlistUnconfirmedDays} are deleted.</li>
 * </ul>
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
    private final OrderCodeGenerator codeGenerator;
    private final Clock clock;

    @Scheduled(cron = "0 30 3 * * *", zone = "Europe/Vienna")
    @Transactional
    public void run() {
        AwgProperties.Retention r = props.retention() == null ? new AwgProperties.Retention(0, 0, 0, 0) : props.retention();
        Instant now = clock.instant();
        int orders = 0;
        for (Order order : orderRepository.findByHandedOverAtBeforeAndAnonymizedAtIsNull(now.minus(Duration.ofDays(r.personalDataDays())))) {
            anonymize(order, now);
            orders++;
        }
        for (Order order : orderRepository.findByHandedOverFalseAndAnonymizedAtIsNullAndCreatedAtBefore(now.minus(Duration.ofDays(r.staleOrderDays())))) {
            if (order.isUnconfirmedWeb()) continue;
            anonymize(order, now);
            orders++;
        }
        long waitlist = waitlistRepository.deleteByConfirmedAtIsNullAndCreatedAtBefore(now.minus(Duration.ofDays(r.waitlistUnconfirmedDays())));
        if (orders > 0 || waitlist > 0) log.info("Retention: erased personal data of {} orders, deleted {} unconfirmed waitlist sign-ups", orders, waitlist);
    }

    void anonymize(Order order, Instant now) {
        for (OrderItem item : order.getOrderItems()) {
            Set<UUID> ids = new HashSet<>();
            item.getPhotos().forEach(p -> ids.add(p.getPhotoId()));
            if (!ids.isEmpty()) photoRepository.findByIdIn(ids).forEach(photoStorage::delete);
            item.getPhotos().clear();
            item.setPetName("");
            item.setNote("");
            if (item.getNameInOrnament() != null) item.setNameInOrnament("");
        }
        Customer customer = order.getCustomer();
        if (customer != null) {
            customer.setName(Customer.DELETED_NAME);
            customer.setEmail("");
            customer.setPhone("");
        }
        order.setDeliveryAddress(null);
        // The old form link must not open anything any more.
        order.setFormToken(codeGenerator.generateFormToken());
        order.setAnonymizedAt(now);
    }
}
