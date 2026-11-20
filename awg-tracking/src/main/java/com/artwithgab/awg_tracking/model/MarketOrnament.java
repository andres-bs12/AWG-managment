package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

/** Numbered display stock. All mutations use conditional repository updates. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Check(constraints = "status in ('unpainted', 'painted', 'sold') and ((status = 'sold') = (sold_at is not null))")
public class MarketOrnament {
    @Id
    @Column(length = 8)
    private String id;

    @Column(nullable = false, length = 12)
    private String status = "unpainted";

    private Instant soldAt;

    // Explicit CAS revision, shared by status, photo and sale writes (not JPA dirty checking).
    @Column(nullable = false)
    private int revision;

    // PostgreSQL bytea, not an OID large object. @Lob would select the latter on PostgreSQL.
    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(columnDefinition = "bytea")
    private byte[] photo;
}
