package com.artwithgab.awg_tracking.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Mirrors `CustomerFormPayload`. This form is the safety net of the business: no custom ornament
 * is painted without contact data and reference photos (photos are checked per custom item in FormService).
 */
public record CustomerFormRequest(
        @NotBlank @Size(max = 120) String customerName,
        @NotBlank @Size(max = 40) String phone,
        @NotBlank @Email @Size(max = 200) String email,
        @NotEmpty @Size(max = 20) @Valid List<ItemFormRequest> items
) {
}
