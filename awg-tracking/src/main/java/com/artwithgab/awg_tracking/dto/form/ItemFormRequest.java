package com.artwithgab.awg_tracking.dto.form;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Mirrors `ItemFormPayload`. */
public record ItemFormRequest(
        @NotNull UUID orderItemId,
        @Size(max = 60) String petName,
        @Size(max = 6) String backName,
        @Size(max = 1000) String note,
        @NotNull @Size(max = 6) @Valid List<FormPhotoRef> photos
) {
}
