package com.artwithgab.awg_tracking.dto.inventory;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.ItemKind;

/** A stock row: custom bases per color, finish and size, or finished ornaments (color, finish and size null). */
public record InventoryItemDto(String id, ItemKind kind, CustomColor color, CustomFinish finish,
                               com.artwithgab.awg_tracking.enums.OrnamentSize size, int quantity) {
}
