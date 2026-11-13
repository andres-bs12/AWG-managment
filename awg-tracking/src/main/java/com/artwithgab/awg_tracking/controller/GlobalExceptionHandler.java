package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.common.ErrorResponse;
import com.artwithgab.awg_tracking.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Turns every error into {status, message}. Internal details are logged, never returned. */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> api(ApiException e) {
        return body(e.getStatus(), e.getMessage(), e.getCode(), e.getField());
    }

    /** Two writers changed the same order at once; the later one must reload instead of overwriting. */
    @ExceptionHandler({org.springframework.orm.ObjectOptimisticLockingFailureException.class, jakarta.persistence.OptimisticLockException.class})
    ResponseEntity<ErrorResponse> concurrentChange(Exception e) {
        return body(HttpStatus.CONFLICT, "This order was changed at the same time. Please reload and try again.", "CONFLICT", null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> invalid(MethodArgumentNotValidException e) {
        var field = e.getBindingResult().getFieldError();
        String message = field == null ? "Check the form and try again."
                : field.getDefaultMessage() != null && Character.isUpperCase(field.getDefaultMessage().charAt(0))
                ? field.getDefaultMessage()
                : "Invalid " + field.getField() + ": " + field.getDefaultMessage();
        return body(HttpStatus.BAD_REQUEST, message, "VALIDATION", field == null ? null : field.getField());
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, MissingServletRequestPartException.class})
    ResponseEntity<ErrorResponse> unreadable(Exception e) {
        return body(HttpStatus.BAD_REQUEST, "The request could not be read.");
    }

    @ExceptionHandler({org.springframework.web.bind.ServletRequestBindingException.class,
            org.springframework.web.multipart.MultipartException.class})
    ResponseEntity<ErrorResponse> badRequest(Exception e) {
        if (e instanceof MaxUploadSizeExceededException m) return tooLarge(m);
        return body(HttpStatus.BAD_REQUEST, "The request could not be read.");
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ErrorResponse> mediaType(Exception e) {
        return body(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "This content type is not supported here.", "BAD_REQUEST", null);
    }

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotAcceptableException.class)
    ResponseEntity<ErrorResponse> notAcceptable(Exception e) {
        return body(HttpStatus.NOT_ACCEPTABLE, "Not acceptable.", "BAD_REQUEST", null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorResponse> tooLarge(MaxUploadSizeExceededException e) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "Photos are too large. Use smaller images.");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorResponse> integrity(DataIntegrityViolationException e) {
        // Only the exception type: the database message can contain the submitted values (PII).
        log.warn("Integrity violation: {}", e.getMostSpecificCause().getClass().getSimpleName());
        return body(HttpStatus.CONFLICT, "That change clashes with existing data. Reload and try again.");
    }

    @ExceptionHandler({NoResourceFoundException.class})
    ResponseEntity<ErrorResponse> notFound(Exception e) {
        return body(HttpStatus.NOT_FOUND, "Not found.");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ErrorResponse> method(HttpRequestMethodNotSupportedException e) {
        return body(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception e) {
        log.error("Unexpected error", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong. Try again.");
    }

    private static ResponseEntity<ErrorResponse> body(HttpStatus status, String message) {
        return body(status, message, null, null);
    }

    private static ResponseEntity<ErrorResponse> body(HttpStatus status, String message, String code, String field) {
        String c = code != null ? code : switch (status.value()) {
            case 400 -> "BAD_REQUEST";
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            case 413 -> "TOO_LARGE";
            default -> "ERROR";
        };
        return ResponseEntity.status(status).body(new ErrorResponse(status.value(), message, c, field));
    }
}
