package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.Order.OrderItemRequest;
import com.artwithgab.awg_tracking.dto.Order.OrderRequest;
import com.artwithgab.awg_tracking.dto.Order.OrderResponse;
import com.artwithgab.awg_tracking.enums.PaymentState;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.mapper.OrderItemMapper;
import com.artwithgab.awg_tracking.mapper.OrderMapper;
import com.artwithgab.awg_tracking.model.Order;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import com.artwithgab.awg_tracking.repository.MarketDayRepository;
import com.artwithgab.awg_tracking.repository.OrderItemRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.service.util.OrderCodeGeneratorService;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 3. Implementar métodos de ciclo de vida de la orden:
 * - getOrderByCode(String code)
 * - updatePaymentState(UUID orderId, PaymentState state)
 * - markAsHandedOver(UUID orderId)
 * <p>
 * 4. Siguientes servicios pendientes:
 * - CustomerFormService:
 * * GET /form/{token} -> Cargar formulario para el cliente.
 * * POST /form/{token} -> Validar si 'formSubmitted' ya es true (lanzar ConflictException).
 * Si es false, guardar fotos, datos de cliente y marcar formSubmitted = true.
 * - TrackingService:
 * * GET /track/{code} -> Retornar TrackingResponse (datos públicos limpios).
 */
@AllArgsConstructor
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderCodeGeneratorService orderCodeGeneratorService;
    private final OrderItemMapper orderItemMapper;
    private final InventoryRepository inventoryRepository;
    private final OrderMapper orderMapper;
    private final MarketDayRepository marketDayRepository;

    @Transactional
    public OrderResponse createOrder(OrderRequest orderRequest) {

        Order order = orderMapper.toEntity(orderRequest);
        order.setCode(orderCodeGeneratorService.generateCode());
        order.setFormToken(orderCodeGeneratorService.generateFormToken());
        order.setFormSubmitted(false);
        order.setHandedOver(false);
        order.setPaymentState(PaymentState.PENDING);

        double total = 0;

        for (OrderItemRequest newItemRequest : orderRequest.orderItemRequestsList()) {
            total += newItemRequest.cost();



            OrderItem newItem = (orderItemMapper.toEntity(newItemRequest));

            switch (newItem.getItemKind()) {
                case CUSTOM -> newItem.setProductionStatus(ProductionStatus.NOT_STARTED);
                case GENERIC -> newItem.setProductionStatus(ProductionStatus.FINISHED);
            }

            if (newItemRequest.marketDayId() != null) {
                marketDayRepository.findById(newItemRequest.marketDayId())
                        .ifPresent(newItem::setMarket);
            }

            linkItemToOrder(order, newItem);

        }
        order.setTotal(total);
        Order savedOrder = orderRepository.save(order);
        return orderMapper.toResponse(savedOrder);
    }

    private void linkItemToOrder(Order order, OrderItem item) {
        order.getOrderItems().add(item);
        item.setOrder(order);
    }

}
