package com.artwithgab.awg_tracking.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Error body for every non-2xx response. The frontend localises by `code` and shows the error next
 * to `field` when present; `message` is the English fallback.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(int status, String message, String code, String field) {
}
