package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;

/** Mirrors `OrderItem["delivery"]`. Market pickup IDs and name prefer the booked day. */
public record DeliveryDto(DeliveryKind kind, String marketId,
        String marketName, String marketDayId, Double pickupHour, AddressDto address) {
}
