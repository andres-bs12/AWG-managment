package com.artwithgab.awg_tracking.dto.agenda;

import com.artwithgab.awg_tracking.dto.common.CustomerDto;
import com.artwithgab.awg_tracking.dto.order.OrderDto;
import com.artwithgab.awg_tracking.dto.order.OrderItemDto;

public record AgendaSlotDto(TimeBlockDto block, OrderDto order, OrderItemDto item, CustomerDto customer) {
}
