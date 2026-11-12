package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.controller.ShopController;
import com.artwithgab.awg_tracking.exception.PayloadTooLargeException;
import com.artwithgab.awg_tracking.payment.StripeClient;
import com.artwithgab.awg_tracking.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebhookBoundsTests {
    private final StripeClient stripe = mock(StripeClient.class);
    private final ShopService shop = mock(ShopService.class);
    private final ShopController controller = new ShopController(shop, stripe, null, new tools.jackson.databind.ObjectMapper(), null);

    @Test void missingAndBlankSignaturesRejectBeforeOpeningBody() throws Exception {
        for (String signature : new String[]{null, " "}) {
            HttpServletRequest request = mock(HttpServletRequest.class);
            when(request.getHeader("Stripe-Signature")).thenReturn(signature);
            assertEquals(400, controller.webhook(request).getStatusCode().value());
            verify(request, never()).getInputStream();
        }
        verifyNoInteractions(stripe, shop);
    }

    @Test void declaredOversizeRejectsBeforeOpeningBody() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getHeader("Stripe-Signature")).thenReturn("signature");
        when(request.getContentLengthLong()).thenReturn(256 * 1024L + 1);
        assertEquals("TOO_LARGE", assertThrows(PayloadTooLargeException.class, () -> controller.webhook(request)).getCode());
        verify(request, never()).getInputStream();
        verifyNoInteractions(stripe, shop);
    }

    @Test void chunkedAndUnderstatedBodiesAreBoundedBeforeVerification() throws Exception {
        for (long length : new long[]{-1, 2}) {
            var request = new org.springframework.mock.web.MockHttpServletRequest();
            request.addHeader("Stripe-Signature", "signature");
            byte[] body = new byte[256 * 1024 + 1000];
            var bytes = new ByteArrayInputStream(body);
            var stream = new org.springframework.mock.web.DelegatingServletInputStream(bytes);
            HttpServletRequest wrapped = spy(request);
            when(wrapped.getContentLengthLong()).thenReturn(length);
            when(wrapped.getInputStream()).thenReturn(stream);
            assertThrows(PayloadTooLargeException.class, () -> controller.webhook(wrapped));
            assertEquals(999, bytes.available());
        }
        verifyNoInteractions(stripe, shop);
    }

    @Test void validRawPayloadReachesSignatureVerificationUnmodifiedAndBadSignatureDoesNotParse() throws Exception {
        String payload = "{ \"type\": \"ignored\", \"name\": \"Kugel ä\" }\n";
        var request = new org.springframework.mock.web.MockHttpServletRequest();
        request.addHeader("Stripe-Signature", "signature");
        request.setContent(payload.getBytes(StandardCharsets.UTF_8));
        when(stripe.verifySignature(payload, "signature")).thenReturn(true);
        assertEquals(200, controller.webhook(request).getStatusCode().value());
        verify(stripe).verifySignature(payload, "signature");
        verify(shop).handleEvent(any());
        reset(stripe, shop);
        request.setContent("not JSON".getBytes(StandardCharsets.UTF_8));
        assertEquals(400, controller.webhook(request).getStatusCode().value());
        verifyNoInteractions(shop);
    }
}
