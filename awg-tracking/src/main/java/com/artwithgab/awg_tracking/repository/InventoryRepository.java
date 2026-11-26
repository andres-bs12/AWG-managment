package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.model.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryRepository extends JpaRepository<Inventory, UUID> {

    Optional<Inventory> findByItemKindAndCustomColorAndCustomFinishAndOrnamentSize(ItemKind itemKind, CustomColor customColor,
            CustomFinish customFinish, com.artwithgab.awg_tracking.enums.OrnamentSize ornamentSize);

    /** The Big (10 cm) row of a colour and finish. */
    default Optional<Inventory> findByItemKindAndCustomColorAndCustomFinish(ItemKind itemKind, CustomColor customColor, CustomFinish customFinish) {
        return findByItemKindAndCustomColorAndCustomFinishAndOrnamentSize(itemKind, customColor, customFinish,
                com.artwithgab.awg_tracking.enums.OrnamentSize.BIG);
    }

    List<Inventory> findByItemKind(ItemKind itemKind);

    Optional<Inventory> findFirstByItemKind(ItemKind itemKind);
}
