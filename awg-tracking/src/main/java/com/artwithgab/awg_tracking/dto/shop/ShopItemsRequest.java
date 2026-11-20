package com.artwithgab.awg_tracking.dto.shop;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ShopItemsRequest(@NotEmpty @Size(max = 10) List<@NotNull @Valid ShopItemShape> items) {
}
