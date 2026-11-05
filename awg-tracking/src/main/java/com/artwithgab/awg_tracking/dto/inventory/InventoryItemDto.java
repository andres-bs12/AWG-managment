package com.artwithgab.awg_tracking.dto.inventory;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;

/** A stock row: custom bases per color, or finished ornaments (color null). */
public record InventoryItemDto(String id, ItemKind kind, CustomColor color, int quantity) {
}
