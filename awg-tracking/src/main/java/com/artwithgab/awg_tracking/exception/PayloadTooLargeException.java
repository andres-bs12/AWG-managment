package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

public class PayloadTooLargeException extends ApiException {
    public PayloadTooLargeException() {
        super(HttpStatus.PAYLOAD_TOO_LARGE, "The request is too large.");
        code("TOO_LARGE");
    }
}
