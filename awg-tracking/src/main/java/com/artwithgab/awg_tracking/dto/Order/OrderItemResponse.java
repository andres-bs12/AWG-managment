package com.artwithgab.awg_tracking.dto.Order;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;

import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record OrderItemResponse(
        UUID id,
        ItemKind itemKind,
        ProductionStatus productionStatus,
        double cost,
        DeliveryKind deliveryKind,
        UUID marketDayId,
        LocalTime pickUpHour,
        Instant paintStart,
        Instant paintEnd,
        Boolean withName,
        String nameInOrnament,
        String petName,
        List<String> photos,
        String note,
        CustomColor customColor
) {
}
