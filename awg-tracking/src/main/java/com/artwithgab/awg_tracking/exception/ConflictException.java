package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

/** 409: the request is valid but clashes with the current state (slot taken, stock, ...). */
public class ConflictException extends ApiException {
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
