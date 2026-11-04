package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/** Smoke test: the full context starts against H2 with the fixed test clock. */
class AwgTrackingApplicationTests extends ApiTestSupport {

    @Autowired
    ApplicationContext context;

    @Test
    void contextLoads() {
        assertNotNull(context);
    }
}
