package com.artwithgab.awg_tracking.dto.shop;

import com.artwithgab.awg_tracking.enums.ItemKind;
import jakarta.validation.constraints.NotNull;

/** Just what capacity depends on. */
public record ShopItemShape(@NotNull ItemKind kind, boolean withName) {
}
