package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.inventory.InventoryItemDto;
import com.artwithgab.awg_tracking.dto.inventory.UpdateInventoryRequest;
import com.artwithgab.awg_tracking.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Staff stock screen. */
@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {
    private final InventoryService inventoryService;

    @GetMapping
    public List<InventoryItemDto> list() {
        return inventoryService.list();
    }

    @PatchMapping("/{id}")
    public InventoryItemDto update(@PathVariable UUID id, @Valid @RequestBody UpdateInventoryRequest body) {
        return inventoryService.setQuantity(id, body.quantity(), body.expectedQuantity());
    }
}
