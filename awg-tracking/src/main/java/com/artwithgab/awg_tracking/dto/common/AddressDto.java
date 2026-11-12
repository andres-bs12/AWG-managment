package com.artwithgab.awg_tracking.dto.common;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Mirrors `Address` in frontend/src/domain/types.ts. */
public record AddressDto(
        @NotBlank @Size(max = 120) String line1,
        @Size(max = 120) String line2,
        @NotBlank @Size(max = 80) String city,
        @NotBlank @Size(max = 12) String postalCode
) {
}
