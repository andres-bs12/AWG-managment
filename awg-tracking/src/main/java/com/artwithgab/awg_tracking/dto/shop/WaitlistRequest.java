package com.artwithgab.awg_tracking.dto.shop;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** "Tell me when orders open next season." */
public record WaitlistRequest(@NotBlank @Email @Size(max = 200) String email, @Pattern(regexp = "de|en") String locale) {
}
