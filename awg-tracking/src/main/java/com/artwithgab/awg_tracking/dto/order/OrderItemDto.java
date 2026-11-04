package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.dto.common.PhotoDto;
import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;

import java.math.BigDecimal;
import java.util.List;

/** Mirrors `OrderItem`. `backName` is the name painted on the back (OrderItem.nameInOrnament). */
public record OrderItemDto(
        String id,
        String orderId,
        ItemKind kind,
        String petName,
        boolean withName,
        CustomColor color,
        String backName,
        String note,
        BigDecimal cost,
        ProductionStatus productionStatus,
        List<PhotoDto> photos,
        boolean formComplete,
        DeliveryDto delivery
) {
}
