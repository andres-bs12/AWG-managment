package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

/** Archived document; deliberately independent of order deletion and personal-data cleanup. */
@Entity
@Table(name = "invoice", uniqueConstraints = @UniqueConstraint(columnNames = {"order_id", "state_key"}))
@Getter
@Setter
@NoArgsConstructor
public class Invoice {
    @Id private Long number;
    @Column(nullable = false) private UUID orderId;
    @Column(nullable = false, length = 128) private String stateKey;
    @Column(nullable = false) private Instant issuedAt;
    @Column(nullable = false) private String recipient;
    @Column(nullable = false) private String subject;
    @Column(nullable = false, columnDefinition = "text") private String body;
    private Instant sentAt;
    /** Failed SMTP attempts; retries stop at InvoiceService.MAX_ATTEMPTS. */
    @Column(nullable = false) private int attempts;
}
