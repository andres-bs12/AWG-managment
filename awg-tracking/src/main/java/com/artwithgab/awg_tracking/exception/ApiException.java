package com.artwithgab.awg_tracking.exception;

import org.springframework.http.HttpStatus;

/** Base for errors whose message is safe to show to the user. */
public abstract class ApiException extends RuntimeException {
    private final HttpStatus status;
    /** Stable machine-readable code for client-side localisation (docs/sprint5-contract.md). */
    private String code;
    /** Request property the error belongs to, e.g. "address.postalCode". */
    private String field;

    protected ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public ApiException code(String code) {
        this.code = code;
        return this;
    }

    public ApiException field(String field) {
        this.field = field;
        return this;
    }

    public String getCode() {
        if (code != null) return code;
        return switch (status.value()) {
            case 400 -> "BAD_REQUEST";
            case 401 -> "UNAUTHORIZED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            case 429 -> "RATE_LIMITED";
            case 502 -> "PAYMENT_PROVIDER";
            case 503 -> "SHOP_CLOSED";
            default -> "ERROR";
        };
    }

    public String getField() {
        return field;
    }
}
