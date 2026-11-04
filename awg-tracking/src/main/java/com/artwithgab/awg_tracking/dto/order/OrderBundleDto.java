package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.dto.agenda.TimeBlockDto;
import com.artwithgab.awg_tracking.dto.common.CustomerDto;

import java.util.List;

/** Mirrors the result of `orders.getOrderBundle`. */
public record OrderBundleDto(OrderDto order, CustomerDto customer, List<OrderItemDto> items, List<TimeBlockDto> blocks) {
}
