package com.artwithgab.awg_tracking.dto.form;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A photo in the form payload. New photos come as multipart parts named `photo-{id}`. */
public record FormPhotoRef(@NotBlank @Size(max = 80) String id, @Size(max = 200) String name) {
}
