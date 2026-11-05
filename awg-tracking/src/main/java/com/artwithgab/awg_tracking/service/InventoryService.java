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

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public java.util.List<com.artwithgab.awg_tracking.dto.inventory.InventoryItemDto> list() {
        return inventoryRepository.findAll().stream()
                .sorted(java.util.Comparator.comparing((Inventory i) -> i.getItemKind().ordinal())
                        .thenComparing(i -> i.getCustomColor() == null ? 0 : i.getCustomColor().ordinal()))
                .map(InventoryService::view).toList();
    }

    /** Gaby sets the count after painting more bases or finished ornaments. */
    @org.springframework.transaction.annotation.Transactional
    public com.artwithgab.awg_tracking.dto.inventory.InventoryItemDto setQuantity(java.util.UUID id, int quantity, Integer expectedQuantity) {
        Inventory row = inventoryRepository.findById(id)
                .orElseThrow(() -> new com.artwithgab.awg_tracking.exception.ResourceNotFoundException("Stock row not found"));
        if (expectedQuantity != null && expectedQuantity != row.getQuantity()) {
            throw new ConflictException("The stock changed meanwhile (now " + row.getQuantity() + "). Check it and save again.")
                    .code("STOCK_CHANGED");
        }
        row.setQuantity(quantity);
        return view(row);
    }

    private static com.artwithgab.awg_tracking.dto.inventory.InventoryItemDto view(Inventory i) {
        return new com.artwithgab.awg_tracking.dto.inventory.InventoryItemDto(i.getId().toString(), i.getItemKind(), i.getCustomColor(), i.getQuantity());
    }

    void deductItem(OrderItem item) {
        Inventory inventory = item.getItemKind() == ItemKind.CUSTOM
                ? inventoryRepository.findByItemKindAndCustomColor(ItemKind.CUSTOM, item.getCustomColor())
                        .orElseThrow(() -> new ConflictException("No stock configured for " + item.getCustomColor().name().toLowerCase() + " ornaments"))
                : inventoryRepository.findFirstByItemKind(ItemKind.GENERIC)
                        .orElseThrow(() -> new ConflictException("No stock configured for finished ornaments"));
        if (inventory.getQuantity() <= 0) {
            throw new ConflictException(item.getItemKind() == ItemKind.CUSTOM
                    ? "Out of stock: " + item.getCustomColor().name().toLowerCase() + " ornaments"
                    : "Out of stock: finished ornaments").code("OUT_OF_STOCK");
        }
        inventory.setQuantity(inventory.getQuantity() - 1);
        item.setInventory(inventory);
    }
}
