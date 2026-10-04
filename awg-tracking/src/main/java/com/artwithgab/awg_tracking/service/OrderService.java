package com.artwithgab.awg_tracking.service;

import org.springframework.stereotype.Service;

/**
 * TODO [HOJA DE RUTA / EN DONDE VAMOS]:
 *
 * 1. Inyectar dependencias necesarias:
 *    - OrderRepository
 *    - OrderCodeGeneratorService
 *    - CustomerRepository
 *    - InventoryRepository (o InventoryService)
 *
 * 2. Implementar 'createOrder(OrderRequest request)':
 *    - Generar código único con orderCodeGeneratorService.generateCode() ("AWG" + 4 dígitos).
 *    - Generar formToken con orderCodeGeneratorService.generateFormToken() (UUID).
 *    - Inicializar formSubmitted = false.
 *    - Calcular total según costos de cada OrderItem.
 *    - Mapear OrderItemRequest a entidades OrderItem (asociadas a esta Order).
 *    - Descontar stock correspondiente en Inventory.
 *    - Guardar orden (cascade persiste items automáticamente).
 *    - Devolver OrderResponse.
 *
 * 3. Implementar métodos de ciclo de vida de la orden:
 *    - getOrderByCode(String code)
 *    - updatePaymentState(UUID orderId, PaymentState state)
 *    - markAsHandedOver(UUID orderId)
 *
 * 4. Siguientes servicios pendientes:
 *    - CustomerFormService:
 *      * GET /form/{token} -> Cargar formulario para el cliente.
 *      * POST /form/{token} -> Validar si 'formSubmitted' ya es true (lanzar ConflictException).
 *                              Si es false, guardar fotos, datos de cliente y marcar formSubmitted = true.
 *    - TrackingService:
 *      * GET /track/{code} -> Retornar TrackingResponse (datos públicos limpios).
 */
@Service
public class OrderService {
    // TODO: Comenzar aquí implementando el método createOrder
}
