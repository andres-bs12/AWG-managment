package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.model.Order;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/**
 * The customer form link (/form/{token}) and the token-based Track access stop working
 * {@code awg.retention.form-link-days} after the order was handed over, or once its data was deleted.
 */
@Component
@RequiredArgsConstructor
public class FormLinkPolicy {
    private final AwgProperties props;
    private final Clock clock;

    public boolean isExpired(Order order) {
        if (order.getAnonymizedAt() != null) return true;
        if (order.getHandedOverAt() == null) return false;
        int days = props.retention() == null ? 30 : props.retention().formLinkDays();
        return clock.instant().isAfter(order.getHandedOverAt().plus(Duration.ofDays(days)));
    }
}
