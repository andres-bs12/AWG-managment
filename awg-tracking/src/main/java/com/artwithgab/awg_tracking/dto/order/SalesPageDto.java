package com.artwithgab.awg_tracking.dto.order;

import java.util.List;

/** Stable staff sales pagination contract; page is zero-based. */
public record SalesPageDto(List<OrderSummaryDto> orders, int page, int size, long totalElements, int totalPages) {}
