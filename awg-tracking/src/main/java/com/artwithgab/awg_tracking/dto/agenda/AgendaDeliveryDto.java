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
        com.artwithgab.awg_tracking.enums.PaymentState paymentState,
        /** Where the order was placed, so staff can tell web pickups from stall sales. */
        com.artwithgab.awg_tracking.enums.OrderSource source,
        /** custom = painted to order; finished = ready-made, can be handed over at once. */
        com.artwithgab.awg_tracking.enums.ItemKind kind,
        /** Vienna delivery postcode (district = digits 2-3), null for market pickups. */
        String postalCode,
        /** A custom ornament still waiting for the customer's form or reference photos. */
        boolean waitingForCustomer,
        java.math.BigDecimal total,
        java.math.BigDecimal amountPaid
) {
}
