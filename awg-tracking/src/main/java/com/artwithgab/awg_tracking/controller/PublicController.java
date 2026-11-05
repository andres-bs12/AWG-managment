package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.dto.form.CustomerFormRequest;
import com.artwithgab.awg_tracking.dto.form.CustomerFormViewDto;
import com.artwithgab.awg_tracking.dto.form.SubmitFormResponse;
import com.artwithgab.awg_tracking.dto.tracking.TrackViewDto;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.FormService;
import com.artwithgab.awg_tracking.service.PhotoStorageService;
import com.artwithgab.awg_tracking.service.TrackingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Endpoints reachable without staff login: Track, customer form and photos. All rate limited. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PublicController {
    /** The customer's proof of ownership for Track writes (see TrackingService). */
    static final String FORM_TOKEN_HEADER = "X-Form-Token";

    private final TrackingService trackingService;
    private final FormService formService;
    private final PhotoStorageService photoStorage;
    private final RateLimiter rateLimiter;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    @GetMapping("/track/{code}")
    public TrackViewDto track(@PathVariable String code, HttpServletRequest request) {
        rateLimiter.check("track", request.getRemoteAddr(), 30);
        return trackingService.getByCode(code, request.getHeader(FORM_TOKEN_HEADER));
    }

    @PatchMapping("/track/{code}/address")
    public TrackViewDto updateAddress(@PathVariable String code, @Valid @RequestBody AddressDto body, HttpServletRequest request) {
        rateLimiter.check("track-write", request.getRemoteAddr(), 10);
        return trackingService.updateViennaAddress(code, request.getHeader(FORM_TOKEN_HEADER), body);
    }

    @GetMapping("/forms/{token}")
    public CustomerFormViewDto form(@PathVariable String token, HttpServletRequest request) {
        rateLimiter.check("form", request.getRemoteAddr(), 60);
        return formService.getForm(token);
    }

    /** Multipart: part "payload" (JSON CustomerFormPayload) plus file parts "photo-{id}". */
    @PostMapping(value = "/forms/{token}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SubmitFormResponse submit(@PathVariable String token, MultipartHttpServletRequest request) {
        rateLimiter.check("form-write", request.getRemoteAddr(), 10);
        MultipartFile payloadPart = request.getFile("payload");
        String json = payloadPart != null ? readPart(payloadPart) : request.getParameter("payload");
        if (json == null || json.isBlank()) throw new BadRequestException("The request could not be read.");
        CustomerFormRequest payload;
        try {
            payload = objectMapper.readValue(json, CustomerFormRequest.class);
        } catch (RuntimeException e) {
            throw new BadRequestException("The request could not be read.");
        }
        Set<ConstraintViolation<CustomerFormRequest>> violations = validator.validate(payload);
        if (!violations.isEmpty()) {
            var v = violations.iterator().next();
            throw new BadRequestException("Invalid " + v.getPropertyPath() + ": " + v.getMessage()).code("VALIDATION").field(v.getPropertyPath().toString());
        }
        Map<String, MultipartFile> files = new HashMap<>();
        request.getFileMap().forEach((name, file) -> {
            if (name.startsWith("photo-")) files.put(name, file);
        });
        if (files.size() > 40) throw new BadRequestException("Too many photos.");
        return formService.submit(token, payload, files);
    }

    @GetMapping("/photos/{id}")
    public ResponseEntity<FileSystemResource> photo(@PathVariable UUID id) {
        PhotoStorageService.PhotoFile file = photoStorage.load(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline")
                .body(new FileSystemResource(file.path()));
    }

    private static String readPart(MultipartFile part) {
        try {
            if (part.getSize() > 200_000) throw new BadRequestException("The request is too large.");
            return new String(part.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (java.io.IOException e) {
            throw new BadRequestException("The request could not be read.");
        }
    }
}
