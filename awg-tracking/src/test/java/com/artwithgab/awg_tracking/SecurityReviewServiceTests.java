package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.*;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.repository.*;
import com.artwithgab.awg_tracking.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Map;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SecurityReviewServiceTests {
    @Mock OrderRepository orders;
    @Mock CalendarService calendar;
    @Mock FormLinkPolicy links;
    @Mock org.springframework.context.ApplicationEventPublisher events;
    @InjectMocks TrackingService tracking;
    @InjectMocks FormService forms;
    @InjectMocks ShopService shop;

    private Order pending(CheckoutStatus status) {
        Order order = new Order();
        order.setCode("AWGABC123");
        order.setFormToken("long-form-token-for-checkout");
        order.setSource(OrderSource.WEB);
        order.setCheckoutStatus(status);
        return order;
    }

    @Test void pendingAndReviewOrdersCannotWriteAddressesOrForms() {
        for (CheckoutStatus status : new CheckoutStatus[]{CheckoutStatus.PENDING, CheckoutStatus.REVIEW}) {
            Order order = pending(status);
            when(orders.findByCodeIgnoreCase(order.getCode())).thenReturn(Optional.of(order));
            when(orders.findByFormToken(order.getFormToken())).thenReturn(Optional.of(order));
            var address = assertThrows(ConflictException.class,
                    () -> tracking.updateViennaAddress(order.getCode(), order.getFormToken(), null));
            assertEquals("PAYMENT_PENDING", address.getCode());
            var form = assertThrows(ConflictException.class, () -> forms.submit(order.getFormToken(), null, Map.of()));
            assertEquals("PAYMENT_PENDING", form.getCode());
        }
        verifyNoInteractions(events, calendar);
    }

    @Test void unauthorizedAbandonDoesNotTakeScheduleLockOrRevealExistence() {
        Order order = pending(CheckoutStatus.PENDING);
        when(orders.findFormTokenByCode(order.getCode())).thenReturn(Optional.of(order.getFormToken()));
        assertDoesNotThrow(() -> shop.abandon(order.getCode(), "wrong-token"));
        assertDoesNotThrow(() -> shop.abandon(order.getCode(), null));
        assertDoesNotThrow(() -> shop.abandon("AWGMISSING", "wrong-token"));
        verifyNoInteractions(calendar, events);
    }
}
