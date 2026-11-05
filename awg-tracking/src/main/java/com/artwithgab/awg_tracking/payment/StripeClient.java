package com.artwithgab.awg_tracking.payment;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

/**
 * Minimal Stripe Checkout client over the REST API (no SDK): creates hosted Checkout Sessions and
 * verifies webhook signatures. Used ONLY by the public web shop; stall sales never go through Stripe.
 * Keys come from STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET; without them the shop answers 503.
 */
@Component
@RequiredArgsConstructor
public class StripeClient {
    private static final long SIGNATURE_TOLERANCE_SECONDS = 300;

    private final AwgProperties props;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    /** Short timeouts: checkout holds the schedule lock while it waits for Stripe. */
    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.stripe.com/v1")
            .requestFactory(timeouts())
            .build();

    private static org.springframework.http.client.SimpleClientHttpRequestFactory timeouts() {
        var f = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout(java.time.Duration.ofSeconds(5));
        f.setReadTimeout(java.time.Duration.ofSeconds(15));
        return f;
    }

    public record Line(String name, BigDecimal unitAmount, int quantity) {
    }

    public record Session(String id, String url) {
    }

    public boolean isConfigured() {
        var s = props.shop();
        return s != null && notBlank(s.stripeSecretKey()) && notBlank(s.stripeWebhookSecret());
    }

    public Session createCheckoutSession(String orderId, String orderCode, String email, List<Line> lines, Instant expiresAt) {
        if (!isConfigured()) throw new ShopUnavailableException();
        var shop = props.shop();
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("mode", "payment");
        // Cards only: payment is known at once, so a completed session is always a paid one.
        form.add("payment_method_types[]", "card");
        form.add("client_reference_id", orderId);
        form.add("metadata[orderId]", orderId);
        form.add("metadata[orderCode]", orderCode);
        form.add("payment_intent_data[metadata][orderId]", orderId);
        form.add("success_url", shop.publicBaseUrl() + "/buy/thanks?code=" + orderCode);
        form.add("cancel_url", shop.publicBaseUrl() + "/buy?cancelled=" + orderCode);
        form.add("expires_at", String.valueOf(expiresAt.getEpochSecond()));
        form.add("locale", "auto");
        if (notBlank(email)) form.add("customer_email", email);
        for (int i = 0; i < lines.size(); i++) {
            Line line = lines.get(i);
            String p = "line_items[" + i + "]";
            form.add(p + "[quantity]", String.valueOf(line.quantity()));
            form.add(p + "[price_data][currency]", "eur");
            form.add(p + "[price_data][unit_amount]", line.unitAmount().movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).toPlainString());
            form.add(p + "[price_data][product_data][name]", line.name());
        }
        try {
            String body = restClient.post().uri("/checkout/sessions")
                    .header("Authorization", "Bearer " + shop.stripeSecretKey())
                    .header("Idempotency-Key", "checkout-" + orderId)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class);
            JsonNode json = objectMapper.readTree(body);
            return new Session(json.path("id").asString(), json.path("url").asString());
        } catch (RestClientException | IllegalArgumentException e) {
            throw new PaymentProviderException();
        }
    }

    /**
     * Expires an open Checkout Session so it can no longer be paid. Fails (502) when Stripe cannot
     * be reached or the session is no longer open (e.g. it was just paid).
     */
    public void expireSession(String sessionId) {
        if (!isConfigured()) throw new ShopUnavailableException();
        if (!sessionId.matches("^cs_[A-Za-z0-9_]+$")) throw new IllegalArgumentException("Bad session id");
        try {
            restClient.post().uri("/checkout/sessions/{id}/expire", sessionId)
                    .header("Authorization", "Bearer " + props.shop().stripeSecretKey())
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException e) {
            throw new PaymentProviderException();
        }
    }

    /** Fetches a Checkout Session (status, payment_status, amount_total, currency). */
    public JsonNode retrieveSession(String sessionId) {
        if (!isConfigured()) throw new ShopUnavailableException();
        if (!sessionId.matches("^cs_[A-Za-z0-9_]+$")) throw new IllegalArgumentException("Bad session id");
        try {
            String body = restClient.get().uri("/checkout/sessions/{id}", sessionId)
                    .header("Authorization", "Bearer " + props.shop().stripeSecretKey())
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(body);
        } catch (RestClientException e) {
            throw new PaymentProviderException();
        }
    }

    /** Verifies the Stripe-Signature header (HMAC-SHA256 of "timestamp.payload", 5 min tolerance). */
    public boolean verifySignature(String payload, String header) {
        if (!isConfigured() || header == null) return false;
        long timestamp = -1;
        List<String> signatures = new java.util.ArrayList<>();
        for (String part : header.split(",")) {
            String[] kv = part.trim().split("=", 2);
            if (kv.length != 2) continue;
            if (kv[0].equals("t")) {
                try {
                    timestamp = Long.parseLong(kv[1]);
                } catch (NumberFormatException e) {
                    return false;
                }
            } else if (kv[0].equals("v1")) {
                signatures.add(kv[1]);
            }
        }
        if (timestamp < 0 || signatures.isEmpty()) return false;
        if (Math.abs(clock.instant().getEpochSecond() - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
        byte[] expected = hmac(props.shop().stripeWebhookSecret(), timestamp + "." + payload);
        for (String sig : signatures) {
            try {
                if (MessageDigest.isEqual(expected, HexFormat.of().parseHex(sig))) return true;
            } catch (IllegalArgumentException ignored) {
                // malformed hex, try next
            }
        }
        return false;
    }

    static byte[] hmac(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /** 503 while Stripe keys are not configured. */
    public static class ShopUnavailableException extends ApiException {
        public ShopUnavailableException() {
            super(HttpStatus.SERVICE_UNAVAILABLE, "Online orders are not open yet.");
        }
    }

    /** 502 when Stripe cannot be reached. */
    public static class PaymentProviderException extends ApiException {
        public PaymentProviderException() {
            super(HttpStatus.BAD_GATEWAY, "Payment could not be started. Try again in a moment.");
        }
    }
}
