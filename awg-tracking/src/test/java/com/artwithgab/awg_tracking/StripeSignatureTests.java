package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.payment.StripeClient;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;

/** Webhook signature check against Stripe's documented scheme: HMAC-SHA256("t.payload"). */
class StripeSignatureTests {
    private static final String SECRET = "whsec_unit_test_secret";
    private static final long NOW = 1_800_000_000L;

    private final StripeClient client = new StripeClient(
            new AwgProperties("Europe/Vienna", null, null, null, null, null, null,
                    new AwgProperties.Shop(true, "http://localhost", "sk_test_dummy", SECRET, BigDecimal.ZERO, 30, 1, 45)),
            new tools.jackson.databind.ObjectMapper(),
            Clock.fixed(Instant.ofEpochSecond(NOW), ZoneOffset.UTC));

    private static String sign(long t, String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void acceptsValidSignature() throws Exception {
        String payload = "{\"id\":\"evt_1\"}";
        assertThat(client.verifySignature(payload, "t=" + NOW + ",v1=" + sign(NOW, payload))).isTrue();
    }

    @Test
    void rejectsTamperedPayloadOldTimestampAndGarbage() throws Exception {
        String payload = "{\"id\":\"evt_1\"}";
        assertThat(client.verifySignature(payload + " ", "t=" + NOW + ",v1=" + sign(NOW, payload))).isFalse();
        assertThat(client.verifySignature(payload, "t=" + (NOW - 1000) + ",v1=" + sign(NOW - 1000, payload))).isFalse();
        assertThat(client.verifySignature(payload, "garbage")).isFalse();
        assertThat(client.verifySignature(payload, null)).isFalse();
    }
}
