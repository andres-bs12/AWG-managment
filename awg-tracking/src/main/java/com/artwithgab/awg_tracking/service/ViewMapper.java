package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.agenda.TimeBlockDto;
import com.artwithgab.awg_tracking.dto.auth.StaffUserDto;
import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.dto.common.CustomerDto;
import com.artwithgab.awg_tracking.dto.common.PhotoDto;
import com.artwithgab.awg_tracking.dto.market.MarketDayDto;
import com.artwithgab.awg_tracking.dto.market.MarketDto;
import com.artwithgab.awg_tracking.dto.order.DeliveryDto;
import com.artwithgab.awg_tracking.dto.order.OrderDto;
import com.artwithgab.awg_tracking.dto.order.OrderItemDto;
import com.artwithgab.awg_tracking.dto.tracking.TrackWhenDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.support.Hours;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Entity → DTO conversion. Hand-written (not MapStruct) because several fields are resolved
 * against the calendar (marketDayId, isToday, block day).
 */
@Component
@lombok.RequiredArgsConstructor
public class ViewMapper {
    private final com.artwithgab.awg_tracking.config.AwgProperties properties;

    public static String photoUrl(PhotoRef ref) {
        return "/api/photos/" + ref.getPhotoId();
    }

    public StaffUserDto staff(StaffUser user) {
        return new StaffUserDto(user.getId().toString(), user.getName(), user.getEmail());
    }

    public MarketDto market(Market m) {
        return new MarketDto(
                m.getId().toString(),
                m.getName(),
                m.getKind(),
                m.getTotalCost(),
                m.getStartDate() == null ? null : m.getStartDate().toString(),
                m.getFinishDate() == null ? null : m.getFinishDate().toString(),
                m.getStall());
    }

    public MarketDayDto marketDay(MarketDay d, LocalDate today) {
        return new MarketDayDto(
                d.getId().toString(),
                d.getMarket().getId().toString(),
                d.getDate().toString(),
                Hours.of(d.getOpenTime()),
                Hours.of(d.getCloseTime()),
                d.getDate().equals(today));
    }

    public CustomerDto customer(Customer c) {
        return new CustomerDto(c.getId().toString(), nz(c.getName()), nz(c.getPhone()), nz(c.getEmail()));
    }

    public AddressDto address(Address a) {
        if (a == null || a.getLine1() == null || a.getLine1().isBlank()) return null;
        return new AddressDto(a.getLine1(), a.getLine2(), a.getCity(), a.getPostalCode());
    }

    public OrderDto order(Order o) {
        return new OrderDto(
                o.getId().toString(),
                o.getCustomer().getId().toString(),
                o.getCode(),
                o.getCode(),
                o.getFormToken(),
                o.getPaymentState(),
                o.getPaymentMethod(),
                o.getTotal(),
                o.getAmountPaid(),
                o.getCreatedAt().toString(),
                o.getOrderItems().stream().map(i -> i.getId().toString()).toList(),
                o.isHandedOver(),
                o.getHandedOverAt() == null ? null : o.getHandedOverAt().toString(),
                o.getStatus(),
                o.getCancelledAt() == null ? null : o.getCancelledAt().toString(),
                o.getCancellationReason(),
                o.isPaymentReview(),
                List.of(),
                o.getCheckoutStatus() == null ? null : o.getCheckoutStatus().name().toLowerCase(java.util.Locale.ROOT),
                o.getSource());
    }

    /** Day the item is handed off, resolved against the calendar. */
    public Optional<MarketDay> handoffDay(OrderItem item, CalendarIndex index) {
        if (item.getDeliveryKind() == DeliveryKind.MARKET) {
            return index.marketDayOn(item.getHandoffDate()).or(() -> index.dayByDate(item.getHandoffDate()));
        }
        return index.dayByDate(item.getHandoffDate());
    }

    public DeliveryDto delivery(OrderItem item, CalendarIndex index) {
        Optional<MarketDay> day = handoffDay(item, index);
        boolean market = item.getDeliveryKind() == DeliveryKind.MARKET;
        return new DeliveryDto(
                item.getDeliveryKind(),
                market ? day.map(d -> d.getMarket().getId().toString()).orElse(null) : null,
                day.map(d -> d.getId().toString()).orElse(null),
                item.getPickUpTime() == null ? null : Hours.of(item.getPickUpTime()),
                market ? null : address(item.getOrder().getDeliveryAddress()));
    }

    public OrderItemDto item(OrderItem i, CalendarIndex index) {
        return new OrderItemDto(
                i.getId().toString(),
                i.getOrder().getId().toString(),
                i.getItemKind(),
                nz(i.getPetName()),
                i.isWithName(),
                i.getCustomColor(),
                i.getCustomFinish(),
                nz(i.getNameInOrnament()),
                nz(i.getNote()),
                i.getCost(),
                i.getProductionStatus(),
                i.getPhotos().stream()
                        .map(p -> new PhotoDto(p.getPhotoId().toString(), p.getName(), photoUrl(p)))
                        .toList(),
                i.getOrder().isFormSubmitted() || i.getItemKind() == ItemKind.GENERIC,
                i.isHandedOver(),
                delivery(i, index));
    }

    /** Painting block derived from the item. Null for items without painting time. */
    public TimeBlockDto block(OrderItem i, CalendarIndex index) {
        if (i.getPaintStart() == null || i.getPaintEnd() == null) return null;
        LocalDate date = i.getPaintStart().toLocalDate();
        return new TimeBlockDto(
                i.getId().toString(),
                index.dayByDate(date).map(d -> d.getId().toString()).orElse(null),
                i.getId().toString(),
                Hours.of(i.getPaintStart().toLocalTime()),
                Hours.of(i.getPaintEnd().toLocalTime()),
                i.getProductionStatus());
    }

    public List<TimeBlockDto> blocks(List<OrderItem> items, CalendarIndex index) {
        return items.stream().map(i -> block(i, index)).filter(Objects::nonNull).toList();
    }

    public TrackWhenDto when(OrderItem item, CalendarIndex index) {
        if (item.getDeliveryKind() == DeliveryKind.DELIVERY) {
            return new TrackWhenDto("vienna", item.getHandoffDate().toString(),
                    Hours.of(properties.shop().deliveryWindowStart()), null, null,
                    Hours.of(properties.shop().deliveryWindowEnd()));
        }
        return handoffDay(item, index)
                .map(day -> new TrackWhenDto(
                        "market",
                        day.getDate().toString(),
                        item.getPickUpTime() == null ? null : Hours.of(item.getPickUpTime()),
                        day.getMarket().getName(),
                        Hours.of(day.getCloseTime())))
                .orElse(new TrackWhenDto("unknown", null, null, null, null));
    }

    static String nz(String s) {
        return s == null ? "" : s;
    }
}
