package com.artwithgab.awg_tracking.mapper;

import com.artwithgab.awg_tracking.dto.Order.OrderRequest;
import com.artwithgab.awg_tracking.dto.Order.OrderResponse;
import com.artwithgab.awg_tracking.model.Order;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring",uses = {OrderItemMapper.class},  unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface OrderMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "formToken", ignore = true)
    @Mapping(target = "code", ignore = true)
    @Mapping(target = "total", ignore = true)
    @Mapping(target = "trackToken", ignore = true)
    @Mapping(target = "customer", ignore = true)
    @Mapping(target = "paymentState", ignore = true)
    @Mapping(target = "handedOver", ignore = true)
    @Mapping(target = "formSubmitted", ignore = true)
    @Mapping(target = "orderItems", ignore = true)
    Order toEntity(OrderRequest orderRequest);

    @Mapping(source = "customer.name", target = "name")
    @Mapping(source = "customer.phone", target = "phone")
    @Mapping(source = "customer.email", target = "email")
    @Mapping(source = "orderItems", target = "orderItemList")
    OrderResponse toResponse(Order order);
}
