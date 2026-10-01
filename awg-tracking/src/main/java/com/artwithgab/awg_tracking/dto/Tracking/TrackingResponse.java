package com.artwithgab.awg_tracking.dto.Tracking;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.OrderState;
import com.artwithgab.awg_tracking.model.MarketDay;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TrackingResponse(
        OrderState orderState,
        String code,
        String clientName,
        DeliveryKind deliveryKind,
        String marketName,
        LocalDate pickUpDate,
        LocalDateTime marketCloseTime,
        LocalDateTime pickUpHourFrom,
        String petName,
        CustomColor customColor,
        double total,
        double dueToPay
) {
}
