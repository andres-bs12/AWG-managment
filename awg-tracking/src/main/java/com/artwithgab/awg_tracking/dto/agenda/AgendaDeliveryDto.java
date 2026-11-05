package com.artwithgab.awg_tracking.dto.agenda;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;

/** Mirrors `AgendaDelivery`. */
public record AgendaDeliveryDto(
        String customerName,
        CustomColor color,
        CustomFinish finish,
        String backName,
        String orderId,
        String orderCode,
        String itemId,
        String title,
        ProductionStatus productionStatus,
        boolean handedOver,
        DeliveryKind deliveryKind,
        Double pickupHour,
        String methodLabel,
        String timeLabel,
        String phone,
        String addressLabel,
        String photoUrl,
        java.math.BigDecimal remaining,
        com.artwithgab.awg_tracking.enums.PaymentState paymentState
) {
}
