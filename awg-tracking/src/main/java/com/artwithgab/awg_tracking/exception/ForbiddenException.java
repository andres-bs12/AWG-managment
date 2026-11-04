package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

/** 403. */
public class ForbiddenException extends ApiException {
    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }
}
