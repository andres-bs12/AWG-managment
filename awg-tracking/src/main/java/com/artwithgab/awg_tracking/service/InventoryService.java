package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.model.Inventory;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Deducts one unit of stock per ornament sold (see docs/contracts-and-dtos.md §4). */
@Service
@RequiredArgsConstructor
public class InventoryService {
    private final InventoryRepository inventoryRepository;

    void deductItem(OrderItem item) {
        Inventory inventory = item.getItemKind() == ItemKind.CUSTOM
                ? inventoryRepository.findByItemKindAndCustomColor(ItemKind.CUSTOM, item.getCustomColor())
                        .orElseThrow(() -> new ConflictException("No stock configured for " + item.getCustomColor().name().toLowerCase() + " ornaments"))
                : inventoryRepository.findFirstByItemKind(ItemKind.GENERIC)
                        .orElseThrow(() -> new ConflictException("No stock configured for finished ornaments"));
        if (inventory.getQuantity() <= 0) {
            throw new ConflictException(item.getItemKind() == ItemKind.CUSTOM
                    ? "Out of stock: " + item.getCustomColor().name().toLowerCase() + " ornaments"
                    : "Out of stock: finished ornaments");
        }
        inventory.setQuantity(inventory.getQuantity() - 1);
        item.setInventory(inventory);
    }
}
