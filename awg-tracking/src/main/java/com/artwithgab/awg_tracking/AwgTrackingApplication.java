package com.artwithgab.awg_tracking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class AwgTrackingApplication {

	public static void main(String[] args) {
		SpringApplication.run(AwgTrackingApplication.class, args);
	}

}
