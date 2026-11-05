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

    @GetMapping(params = "code")
    public OrderDto byCode(@RequestParam String code) {
        return orderService.getOrderByCode(code);
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
    public ResponseEntity<OrderDto> createSale(@Valid @RequestBody CreateSaleRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(orderService.createSale(body));
    }

    @PatchMapping("/{id}/items/{itemId}/status")
    public ResponseEntity<Void> setItemStatus(@PathVariable UUID id, @PathVariable UUID itemId, @Valid @RequestBody ItemStatusRequest body) {
        orderService.setItemStatus(id, itemId, body.status());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/handed-over")
    public ResponseEntity<Void> setHandedOver(@PathVariable UUID id, @Valid @RequestBody HandedOverRequest body) {
        orderService.setHandedOver(id, body.handedOver());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/cancel")
    public org.springframework.http.ResponseEntity<Void> cancel(@PathVariable UUID id) {
        orderService.cancelOrder(id);
        return org.springframework.http.ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/payment-state")
    public OrderDto setPaymentState(@PathVariable UUID id, @Valid @RequestBody PaymentStateRequest body) {
        return orderService.updatePaymentState(id, body.state(), body.method(), body.amountPaid());
    }
}
