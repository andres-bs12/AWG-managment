package com.artwithgab.awg_tracking.dto.common;



/** Error body for every non-2xx response. The frontend shows `message`. */
public record ErrorResponse(int status, String message) {
}
