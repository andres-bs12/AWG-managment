package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

/** Base for errors whose message is safe to show to the user. */
public abstract class ApiException extends RuntimeException {
    private final HttpStatus status;

    protected ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
