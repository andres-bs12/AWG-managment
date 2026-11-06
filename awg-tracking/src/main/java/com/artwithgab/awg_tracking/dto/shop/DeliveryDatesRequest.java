package com.artwithgab.awg_tracking.dto.shop;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record DeliveryDatesRequest(@NotEmpty @Size(max = 10) @Valid List<ShopItemShape> items) {
}
