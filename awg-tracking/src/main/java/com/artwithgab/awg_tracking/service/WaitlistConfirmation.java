package com.artwithgab.awg_tracking.service;

/** Sent after a waitlist sign-up: the e-mail with the confirmation and unsubscribe links (double opt-in). */
public record WaitlistConfirmation(String email, String locale, String token) {
}
