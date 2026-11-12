package com.artwithgab.awg_tracking.dto.inventory;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.ItemKind;

/** A stock row: custom bases per color and finish, or finished ornaments (color and finish null). */
public record InventoryItemDto(String id, ItemKind kind, CustomColor color, CustomFinish finish, int quantity) {
}
