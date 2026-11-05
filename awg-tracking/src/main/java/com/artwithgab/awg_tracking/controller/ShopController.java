package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.shop.*;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.payment.StripeClient;
import com.artwithgab.awg_tracking.security.RateLimiter;
import com.artwithgab.awg_tracking.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Public web shop (Vienna delivery, Stripe Checkout). */
@RestController
@RequestMapping("/api/shop")
@RequiredArgsConstructor
public class ShopController {
    private final ShopService shopService;
    private final StripeClient stripe;
    private final RateLimiter rateLimiter;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    @GetMapping("/config")
    public ShopConfigDto config() {
        return shopService.config();
    }

    @PostMapping("/delivery-dates")
    public List<DeliveryDateDto> deliveryDates(@Valid @RequestBody DeliveryDatesRequest body, HttpServletRequest request) {
        rateLimiter.check("shop-dates", request.getRemoteAddr(), 30);
        return shopService.deliveryDates(body.items());
    }

    @PostMapping("/pickup-days")
    public List<PickupDayDto> pickupDays(@Valid @RequestBody DeliveryDatesRequest body, HttpServletRequest request) {
        rateLimiter.check("shop-dates", request.getRemoteAddr(), 30);
        return shopService.pickupDays(body.items());
    }

    /** Multipart: part "payload" (CheckoutRequest JSON) plus file parts "photo-{id}". */
    @PostMapping(value = "/checkout", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CheckoutResponse checkout(MultipartHttpServletRequest request) {
        rateLimiter.check("shop-checkout", request.getRemoteAddr(), 5);
        MultipartFile part = request.getFile("payload");
        String json;
        try {
            json = part != null && part.getSize() < 200_000 ? new String(part.getBytes(), StandardCharsets.UTF_8) : request.getParameter("payload");
        } catch (java.io.IOException e) {
            throw new BadRequestException("The request could not be read.");
        }
        if (json == null || json.isBlank()) throw new BadRequestException("The request could not be read.");
        CheckoutRequest payload;
        try {
            payload = objectMapper.readValue(json, CheckoutRequest.class);
        } catch (RuntimeException e) {
            throw new BadRequestException("The request could not be read.");
        }
        Set<ConstraintViolation<CheckoutRequest>> violations = validator.validate(payload);
        if (!violations.isEmpty()) {
            var v = violations.iterator().next();
            String msg = v.getMessage();
            throw new BadRequestException(msg != null && !msg.isEmpty() && Character.isUpperCase(msg.charAt(0)) ? msg : "Invalid " + v.getPropertyPath() + ": " + msg)
                    .code("VALIDATION").field(v.getPropertyPath().toString());
        }
        Map<String, MultipartFile> files = new HashMap<>();
        request.getFileMap().forEach((name, file) -> {
            if (name.startsWith("photo-")) files.put(name, file);
        });
        if (files.size() > 60) throw new BadRequestException("Too many photos.");
        return shopService.checkout(payload, files);
    }

    @PostMapping("/checkout/{code}/abandon")
    public ResponseEntity<Void> abandon(@PathVariable String code, HttpServletRequest request) {
        rateLimiter.check("shop-abandon", request.getRemoteAddr(), 10);
        shopService.abandon(code, request.getHeader("X-Form-Token"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/waitlist")
    public ResponseEntity<Void> waitlist(@Valid @RequestBody com.artwithgab.awg_tracking.dto.shop.WaitlistRequest body, HttpServletRequest request) {
        rateLimiter.check("shop-waitlist", request.getRemoteAddr(), 5);
        shopService.joinWaitlist(body.email(), body.locale());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/waitlist/confirm")
    public ResponseEntity<Void> confirmWaitlist(@Valid @RequestBody com.artwithgab.awg_tracking.dto.shop.WaitlistTokenRequest body, HttpServletRequest request) {
        rateLimiter.check("shop-waitlist-token", request.getRemoteAddr(), 10);
        shopService.confirmWaitlist(body.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/waitlist/unsubscribe")
    public ResponseEntity<Void> leaveWaitlist(@Valid @RequestBody com.artwithgab.awg_tracking.dto.shop.WaitlistTokenRequest body, HttpServletRequest request) {
        rateLimiter.check("shop-waitlist-token", request.getRemoteAddr(), 10);
        shopService.leaveWaitlist(body.token());
        return ResponseEntity.noContent().build();
    }

    /** Stripe calls this. The signature is verified with STRIPE_WEBHOOK_SECRET before anything is read. */
    @PostMapping("/stripe/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String payload, @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        if (!stripe.verifySignature(payload, signature)) return ResponseEntity.badRequest().build();
        shopService.handleEvent(objectMapper.readTree(payload));
        return ResponseEntity.ok().build();
    }
}
