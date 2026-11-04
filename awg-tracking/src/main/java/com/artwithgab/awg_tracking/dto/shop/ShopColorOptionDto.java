package com.artwithgab.awg_tracking.dto.shop;

import com.artwithgab.awg_tracking.enums.CustomColor;

/** A color the custom ornament comes in; inStock=false means sold out right now. */
public record ShopColorOptionDto(CustomColor color, boolean inStock) {
}
