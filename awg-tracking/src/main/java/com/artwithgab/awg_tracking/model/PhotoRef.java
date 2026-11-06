package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/** Link from an order item to a {@link StoredPhoto}, with the name shown in the UI. */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PhotoRef {
    @Column(name = "photo_id", nullable = false)
    private UUID photoId;
    @Column(name = "photo_name", nullable = false)
    private String name;
}
