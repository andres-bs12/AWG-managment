package com.artwithgab.awg_tracking.dto.shop;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import com.artwithgab.awg_tracking.enums.DeliveryKind;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Web order. {@code deliveryKind} is "vienna" (default; needs {@code address}, Wed/Fri) or "market"
 * (pickup at the stall on {@code deliveryDate} at {@code pickupTime}; no address, no delivery fee).
 * Photos come as multipart parts named photo-{id}.
 */
public record CheckoutRequest(
        @NotBlank @Size(max = 120) String customerName,
        @NotBlank @Email @Size(max = 200) String email,
        @NotBlank @Size(max = 40) String phone,
        @Valid AddressDto address,
        @NotNull LocalDate deliveryDate,
        DeliveryKind deliveryKind,
        LocalTime pickupTime,
        @NotEmpty @Size(max = 10) @Valid List<ShopItemRequest> items,
        @AssertTrue(message = "Accept the terms to continue") boolean acceptTerms
) {
    public boolean isPickup() {
        return deliveryKind == DeliveryKind.MARKET;
    }
}
