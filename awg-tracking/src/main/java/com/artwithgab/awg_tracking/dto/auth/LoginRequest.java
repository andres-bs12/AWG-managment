package com.artwithgab.awg_tracking.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(@NotBlank @Size(max = 200) String email, @NotBlank @Size(max = 200) String password) {
}
