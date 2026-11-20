package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;

import java.time.LocalDate;

/** Mirrors `OrderItem["delivery"]`. marketId/marketDayId are resolved from the handoff date. */
public record DeliveryDto(DeliveryKind kind, String marketId, String marketDayId, Double pickupHour, AddressDto address,
                          LocalDate deliveryDate, LocalDate arrivalFrom, LocalDate arrivalTo) {
}
