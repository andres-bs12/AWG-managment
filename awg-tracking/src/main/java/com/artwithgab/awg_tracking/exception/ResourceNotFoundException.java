package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

/** 404. */
public class ResourceNotFoundException extends ApiException {
    public ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
