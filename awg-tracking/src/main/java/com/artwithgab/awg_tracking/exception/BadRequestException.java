package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

/** 400: the request breaks a business rule. */
public class BadRequestException extends ApiException {
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
