package com.artwithgab.awg_tracking.dto.shop;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;

/** A color and finish the custom ornament comes in; inStock=false means sold out right now. */
public record ShopColorOptionDto(CustomColor color, CustomFinish finish, boolean inStock) {
}
