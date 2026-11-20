package com.artwithgab.awg_tracking;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

/** Fixed "now": Tuesday 2026-11-24 09:00 in Vienna, so every date in the tests is deterministic. */
@TestConfiguration
public class TestClockConfig {
    public static final ZoneId VIENNA = ZoneId.of("Europe/Vienna");

    @Bean
    @Primary
    Clock testClock(@org.springframework.beans.factory.annotation.Value("${awg.test.clock:2026-11-24T08:00:00Z}") String instant) {
        return Clock.fixed(Instant.parse(instant), VIENNA);
    }
}
