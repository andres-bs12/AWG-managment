package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Mirrors `CreateSaleItemInput`. The price is NOT part of the request: the server computes it.
 * Conditional rules (custom → paint slot, market custom → pickup hour, ...) live in OrderService.
 */
public record CreateSaleItemRequest(
        @NotNull ItemKind kind,
        boolean withName,
        CustomColor color,
        CustomFinish finish,
        LocalDate paintDate,
        Double paintStart,
        Double paintEnd,
        @NotNull DeliveryKind deliveryKind,
        UUID marketId,
        UUID marketDayId,
        Double pickupHour,
        @Valid AddressDto address
) {
}
