package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

/** 429. */
public class TooManyRequestsException extends ApiException {
    public TooManyRequestsException() {
        super(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Wait a minute and try again.");
    }
}
