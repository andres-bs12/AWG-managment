package com.artwithgab.awg_tracking.dto.shop;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;

/** Web order: Vienna delivery only. Photos come as multipart parts named photo-{id}. */
public record CheckoutRequest(
        @NotBlank @Size(max = 120) String customerName,
        @NotBlank @Email @Size(max = 200) String email,
        @NotBlank @Size(max = 40) String phone,
        @NotNull @Valid AddressDto address,
        @NotNull LocalDate deliveryDate,
        @NotEmpty @Size(max = 10) @Valid List<ShopItemRequest> items,
        @AssertTrue(message = "Accept the terms to continue") boolean acceptTerms
) {
}
