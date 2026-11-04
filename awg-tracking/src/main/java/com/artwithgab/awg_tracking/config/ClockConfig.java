package com.artwithgab.awg_tracking.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class ClockConfig {
    /** Vienna wall clock. Tests replace it with a fixed clock. */
    @Bean
    Clock clock(AwgProperties props) {
        return Clock.system(ZoneId.of(props.zone()));
    }
}
