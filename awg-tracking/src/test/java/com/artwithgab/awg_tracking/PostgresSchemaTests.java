package com.artwithgab.awg_tracking;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Production-like start-up: the same PostgreSQL major version as docker-compose.yml, every Flyway
 * migration, and Hibernate {@code ddl-auto=validate}. If a migration and an entity disagree (e.g. the
 * SMALLINT vs Integer column that kept production down on 26 Nov 2026), the context does not start and
 * this class fails, exactly as the real server would. The other tests use H2 without Flyway and cannot
 * see that class of bug.
 *
 * <p>Needs Docker. CI always has it; on a laptop without Docker the class is skipped.
 */
@Testcontainers(disabledWithoutDocker = true)
@TestPropertySource(properties = {
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.flyway.enabled=true",
})
class PostgresSchemaTests extends ApiTestSupport {

    // Keep in step with the postgres image in docker-compose.yml.
    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void everyMigrationAppliesAndHibernateValidatesTheSchema() {
        // Reaching this line means Flyway ran and Hibernate validate accepted every entity.
        Integer failed = jdbc.queryForObject("select count(*) from flyway_schema_history where not success", Integer.class);
        assertEquals(0, failed);
        Integer latest = jdbc.queryForObject(
                "select max(cast(version as integer)) from flyway_schema_history where version is not null", Integer.class);
        assertTrue(latest != null && latest >= 24, "expected migrations up to at least V24, got V" + latest);
    }

    @Test
    void pricesAndBackNameLimitSaveOnPostgres() throws Exception {
        String token = login();
        mvc.perform(get("/api/prices").header("Authorization", bearer(token))).andExpect(status().isOk());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("customPrice", new BigDecimal("50.00"));
        body.put("customMediumPrice", new BigDecimal("45.00"));
        body.put("finishedPrice", new BigDecimal("35.00"));
        body.put("nameExtra", new BigDecimal("5.00"));
        body.put("shippingFee", new BigDecimal("5.00"));
        body.put("postCollectionDays", List.of("tuesday", "friday"));
        body.put("backNameMax", 7);
        long revision = ((Number) read(mvc.perform(get("/api/prices").header("Authorization", bearer(token))).andReturn(),
                "$.revision")).longValue();
        body.put("expectedRevision", revision);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/prices")
                        .header("Authorization", bearer(token)).contentType(MediaType.APPLICATION_JSON).content(json(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.backNameMax").value(7))
                .andExpect(jsonPath("$.customMediumPrice").value(45.0));
    }

    @Test
    void stallSaleWithSizesDiscountAndPriceChangeOnPostgres() throws Exception {
        String token = login();
        // Medium bases start at 0 after V22; count some so the medium sale is not sold out.
        jdbc.update("update inventory set quantity = 5 where item_kind = 'CUSTOM'");

        var big = customItem(true, TUE, 10.0, 11.25, "market", dayId(token, SAT), 14.0);
        var medium = customItem(false, TUE, 11.5, 12.5, "market", dayId(token, SAT), 15.0);
        medium.put("size", "medium");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", List.of(big, medium, finishedItem()));
        body.put("chargedTotal", 120);
        MvcResult res = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(json(body))).andReturn();
        assertEquals(201, res.getResponse().getStatus(), res.getResponse().getContentAsString());
        String id = read(res, "$.id");

        mvc.perform(patch("/api/orders/" + id + "/payment-state").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("state", "paid", "method", "cash"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amountPaid").value(120.0));
        mvc.perform(patch("/api/orders/" + id + "/price").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("chargedTotal", 110))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(110.0))
                .andExpect(jsonPath("$.amountPaid").value(110.0));

        // Lists that read the new columns back.
        mvc.perform(get("/api/orders/" + id).header("Authorization", bearer(token))).andExpect(status().isOk());
        mvc.perform(get("/api/inventory").header("Authorization", bearer(token))).andExpect(status().isOk());
    }
}
