package com.artwithgab.awg_tracking.dto.CustomerForm;

import jakarta.annotation.Nullable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CustomerFormRequest(
        @NotEmpty
        @Valid
        List<String> photos,

        @NotBlank
        String name,
        @NotBlank
        String petName,
        @NotBlank
        String phone,
        @NotBlank
        String email,
        @Nullable
        String notes,
        @Nullable
        String nameInOrnament

) {
}
