package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MakeRoomReplay {
    @Id
    @Column(length = 64)
    private String idempotencyKey;

    /** SHA-256 of the request body: a reused key with another body is rejected, not replayed. */
    @Column(nullable = false, length = 64)
    private String requestHash;

    @Column(nullable = false, columnDefinition = "text")
    private String responseBody;

    public MakeRoomReplay(String idempotencyKey, String requestHash, String responseBody) {
        this.idempotencyKey = idempotencyKey;
        this.requestHash = requestHash;
        this.responseBody = responseBody;
    }
}
