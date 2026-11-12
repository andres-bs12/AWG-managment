package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.order.*;
import com.artwithgab.awg_tracking.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;

    @GetMapping(params = "!code")
    public SalesPageDto list(@RequestParam(required = false) String state,
                             @RequestParam(required = false) String source,
                             @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
                             @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size,
                             @RequestParam(required = false) String query) {
        return orderService.listSales(state, source, from, to, page, size, query);
    }

    @GetMapping(params = "code")
    public OrderDto byCode(@RequestParam String code) {
        return orderService.getOrderByCode(code);
    }

    /** Staff search by code, name or phone; at least 2 characters. */
    @GetMapping("/search")
    public java.util.List<com.artwithgab.awg_tracking.dto.order.OrderSummaryDto> search(@RequestParam("q") String q) {
        return orderService.search(q);
    }

    /** Web orders waiting for Stripe or flagged for review (amount mismatch). */
    @GetMapping("/attention")
    public java.util.List<com.artwithgab.awg_tracking.dto.order.OrderSummaryDto> attention() {
        return orderService.needingAttention();
    }

    @GetMapping("/{id}")
    public OrderDto get(@PathVariable UUID id) {
        return orderService.getOrder(id);
    }

    @GetMapping("/{id}/bundle")
    public OrderBundleDto bundle(@PathVariable UUID id) {
        return orderService.getOrderBundle(id);
    }

    @PostMapping
    public ResponseEntity<OrderDto> createSale(@Valid @RequestBody CreateSaleRequest body,
                                               @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.matches("[A-Za-z0-9_-]{8,64}")) {
            throw new com.artwithgab.awg_tracking.exception.BadRequestException("Invalid Idempotency-Key.").code("VALIDATION").field("Idempotency-Key");
        }
        OrderService.SaleResult result = orderService.createSale(body, idempotencyKey);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.order());
    }

    @PatchMapping("/{id}/items/{itemId}/status")
    public ResponseEntity<Void> setItemStatus(@PathVariable UUID id, @PathVariable UUID itemId, @Valid @RequestBody ItemStatusRequest body) {
        orderService.setItemStatus(id, itemId, body.status());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/handed-over")
    public ResponseEntity<Void> setHandedOver(@PathVariable UUID id, @Valid @RequestBody HandedOverRequest body) {
        orderService.setHandedOver(id, body.handedOver(), body.itemIds());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/cancel")
    public org.springframework.http.ResponseEntity<Void> cancel(@PathVariable UUID id, @RequestBody(required = false) CancelRequest body) {
        orderService.cancelOrder(id, body == null ? null : body.reason());
        return org.springframework.http.ResponseEntity.noContent().build();
    }

    public record CancelRequest(String reason) {}

    @PatchMapping("/{id}/payment-state")
    public OrderDto setPaymentState(@PathVariable UUID id, @Valid @RequestBody PaymentStateRequest body) {
        return orderService.updatePaymentState(id, body.state(), body.method(), body.amountPaid());
    }
}
