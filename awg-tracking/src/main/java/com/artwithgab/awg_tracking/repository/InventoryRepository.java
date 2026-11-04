package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.model.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<Inventory, UUID> {

    Optional<Inventory> findByItemKindAndCustomColor(ItemKind itemKind, CustomColor customColor);

    Optional<Inventory> findFirstByItemKind(ItemKind itemKind);
}
