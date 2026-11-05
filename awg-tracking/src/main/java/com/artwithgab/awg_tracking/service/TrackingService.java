package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.dto.tracking.TrackItemDto;
import com.artwithgab.awg_tracking.dto.tracking.TrackViewDto;
import com.artwithgab.awg_tracking.dto.tracking.TrackWhenDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ForbiddenException;
import com.artwithgab.awg_tracking.dto.order.DeliveryDto;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Public Track page (by order code). Shows only harmless data: first name, pet names, handoff. */
@Service
@RequiredArgsConstructor
public class TrackingService {
    private final OrderRepository orderRepository;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final CalendarService calendarService;
    private final ViewMapper mapper;

    /**
     * The address is personal data, so it is only returned with the order's form token
     * (kept by the customer's browser after the form), never for a code-only lookup.
     */
    @Transactional(readOnly = true)
    public TrackViewDto getByCode(String code, String formToken) {
        Order order = find(code);
        return view(order, ownsOrder(order, formToken));
    }

    /**
     * The customer adds or corrects the Vienna address until the order is handed over. The short public
     * code is not proof of ownership, so the long form token is required.
     */
    @Transactional
    public TrackViewDto updateViennaAddress(String code, String formToken, AddressDto address) {
        Order order = find(code);
        if (!ownsOrder(order, formToken)) {
            throw new ForbiddenException("Open the link from your order form to change the address.");
        }
        if (order.getOrderItems().stream().noneMatch(i -> i.getDeliveryKind() == DeliveryKind.DELIVERY)) {
            throw new BadRequestException("This order is not delivered in Vienna");
        }
        if (order.isHandedOver()) throw new ConflictException("This order was already delivered");
        if (!com.artwithgab.awg_tracking.support.ViennaAddress.isViennaPostal(address.postalCode())) {
            throw new BadRequestException("We only deliver inside Vienna (postal codes 1010–1230).");
        }
        order.setDeliveryAddress(OrderService.toAddress(address));
        events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        return view(order, true);
    }

    static boolean ownsOrder(Order order, String formToken) {
        return formToken != null && java.security.MessageDigest.isEqual(
                formToken.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                order.getFormToken().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static DeliveryDto withoutAddressUnless(DeliveryDto d, boolean include) {
        return include ? d : new DeliveryDto(d.kind(), d.marketId(), d.marketDayId(), d.pickupHour(), null);
    }

    private Order find(String code) {
        if (code == null || !code.trim().matches("(?i)AWG[A-Z0-9]{4,6}")) {
            throw new ResourceNotFoundException("Order not found. Check the code.");
        }
        return orderRepository.findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found. Check the code."));
    }

    private TrackViewDto view(Order order, boolean includeAddress) {
        CalendarIndex index = calendarService.snapshot();
        List<OrderItem> items = order.getOrderItems();
        OrderItem first = items.isEmpty() ? null : items.getFirst();
        String status = order.isHandedOver() ? "delivered"
                : items.stream().allMatch(i -> i.getProductionStatus() == ProductionStatus.FINISHED) ? "ready" : "preparing";
        String name = order.getCustomer().getName();
        String firstName = name == null || name.isBlank() ? "there" : name.trim().split("\\s+")[0];
        TrackWhenDto when = first == null ? new TrackWhenDto("unknown", null, null, null, null) : mapper.when(first, index);
        return new TrackViewDto(
                order.getTotal(),
                order.getPaymentState(),
                order.getCode(),
                status,
                firstName,
                items.stream().map(i -> new TrackItemDto(i.getCustomColor(), i.getCost(), ViewMapper.nz(i.getPetName()),
                        i.getItemKind(), i.getProductionStatus(), i.isWithName(), ViewMapper.nz(i.getNameInOrnament()))).toList(),
                first == null ? null : withoutAddressUnless(mapper.delivery(first, index), includeAddress),
                when);
    }
}
