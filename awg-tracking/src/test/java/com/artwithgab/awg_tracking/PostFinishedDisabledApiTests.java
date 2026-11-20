package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "awg.post.finished-with-custom=false",
        "spring.datasource.url=jdbc:h2:mem:awg-post-disabled;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH"
})
class PostFinishedDisabledApiTests extends ApiTestSupport {
    @Test
    void disablingFinishedPostRejectsTheMixedParcelButKeepsCustomPostAvailable() throws Exception {
        String token = login();
        mvc.perform(get("/api/prices").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.finishedWithCustom").value(false));

        var finished = finishedItem();
        finished.put("deliveryKind", "post");
        finished.put("address", Map.of("line1", "Hauptplatz 1", "postalCode", "4020", "city", "Linz"));
        var custom = customItem(false, WED, 10.0, 11.0, "post", null, null);
        var result = sale(token, finished, custom);
        assertEquals(400, result.getResponse().getStatus());
        assertEquals("SHIPPING_NEEDS_CUSTOM", this.<String>read(result, "$.code"));
        saleOk(token, custom);
    }
}
