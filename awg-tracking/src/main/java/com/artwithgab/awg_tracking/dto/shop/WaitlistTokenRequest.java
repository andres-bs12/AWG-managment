package com.artwithgab.awg_tracking.dto.shop;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Token from the waitlist e-mail (confirm or unsubscribe). */
public record WaitlistTokenRequest(@NotBlank @Size(max = 64) String token) {
}
