package com.artwithgab.awg_tracking.dto.tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TrackItemDto(
        CustomColor color,
        CustomFinish finish,
        com.artwithgab.awg_tracking.enums.OrnamentSize size,
        BigDecimal cost,
        String petName,
        ItemKind kind,
        ProductionStatus productionStatus,
        boolean withName,
        String backName,
        DeliveryKind deliveryKind,
        LocalDate arrivalFrom,
        LocalDate arrivalTo,
        boolean handedOver
) {
}
