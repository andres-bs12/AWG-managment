package com.artwithgab.awg_tracking.dto.agenda;

import com.artwithgab.awg_tracking.dto.market.MarketDayDto;
import com.artwithgab.awg_tracking.dto.market.MarketDto;

import java.util.List;

public record AgendaDayDto(MarketDayDto marketDay, MarketDto market, List<AgendaSlotDto> slots, List<AgendaDeliveryDto> deliveries) {
}
