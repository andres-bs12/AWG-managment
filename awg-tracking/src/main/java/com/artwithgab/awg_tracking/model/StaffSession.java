package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Opaque bearer session. Only the SHA-256 hash of the token is stored, so a DB leak does not leak sessions. */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class StaffSession {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "staff_user_id")
    private StaffUser staffUser;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;

    /** {@link #APP} for the staff web app, {@link #MCP} for the Claude connector (only valid on /mcp). */
    @Column(nullable = false, length = 8)
    private String audience = APP;

    public static final String APP = "app";
    public static final String MCP = "mcp";
}
