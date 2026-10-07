package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.Inventory;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.repository.InventoryRepository;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;

@AllArgsConstructor
@Service
public class InventoryService {
    private final InventoryRepository inventoryRepository;

    void deduct(Inventory inventory) {
        if (inventory.getQuantity() > 0) {
            inventory.setQuantity(inventory.getQuantity() - 1);
        } else {
            throw new ConflictException("Out of stock for " + inventory.getItemKind());// to change.
        }
    }


    void deductItem(OrderItem item) {
        switch (item.getItemKind()) {
            case CUSTOM -> {
                Inventory inventory = inventoryRepository.findInventoriesByCustomColor(item.getCustomColor()).orElseThrow(
                        () -> new ResourceNotFoundException("Item color not found, must be Generic or Custom, actual: " + item.getCustomColor()));
                deduct(inventory);
                item.setInventory(inventory);
                inventoryRepository.save(inventory);

            }
            case GENERIC -> {
                Inventory inventory = inventoryRepository.findByItemKind(ItemKind.GENERIC).orElseThrow(
                        () -> new ResourceNotFoundException("Item kind not found, must be Generic or Custom, actual: " + item.getItemKind()));
                deduct(inventory);
                item.setInventory(inventory);
                inventoryRepository.save(inventory);
            }
        }
    }
}

