package com.artwithgab.awg_tracking.exception;

public class OrderCodeAlreadyExistException extends ConflictException {
    public OrderCodeAlreadyExistException(String code) {
        super("Order code already exist" + code);
    }
}
