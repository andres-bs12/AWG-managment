package com.artwithgab.awg_tracking.dto.tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;

import java.math.BigDecimal;

public record TrackItemDto(
        CustomColor color,
        CustomFinish finish,
        BigDecimal cost,
        String petName,
        ItemKind kind,
        ProductionStatus productionStatus,
        boolean withName,
        String backName
) {
}
