package com.artwithgab.awg_tracking.dto.Order;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import jakarta.annotation.Nullable;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record OrderItemRequest(
        @NotNull(message = "Order Item must have a kind (custom or generic")
        ItemKind itemKind,

        @PositiveOrZero
        double cost,

        @NotNull(message = "Delivery kind should be set")
        DeliveryKind deliveryKind,

        @NotNull
        UUID marketDayId,

        @Nullable
        LocalTime pickUpHour,

        @Nullable
        LocalDateTime startDate,

        @Nullable
        LocalDateTime endDate,

        boolean withName,

        @Nullable
        String nameInOrnament,

        @Nullable
        String petName,

        @Nullable
        List<String> photos,

        @NotNull(message = "Custom color should be set")
        CustomColor customColor
) {
}
