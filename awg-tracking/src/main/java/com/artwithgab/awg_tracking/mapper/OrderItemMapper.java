package com.artwithgab.awg_tracking.mapper;

import com.artwithgab.awg_tracking.dto.Order.OrderItemRequest;
import com.artwithgab.awg_tracking.dto.Order.OrderItemResponse;
import com.artwithgab.awg_tracking.dto.Order.OrderResponse;
import com.artwithgab.awg_tracking.model.OrderItem;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)

public interface OrderItemMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "productionStatus", ignore = true)
    @Mapping(target = "market", ignore = true)
    @Mapping(target = "inventory", ignore = true)
    @Mapping(target = "note", ignore = true)
    @Mapping(target = "order", ignore = true)
    OrderItem toEntity(OrderItemRequest orderItemRequest);

    @Mapping(source = "market.id", target = "marketDayId")
    OrderItemResponse toResponse(OrderItem orderItem);
}
