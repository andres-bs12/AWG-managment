package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Contact data. Created empty ("Walk-in") at the stall and completed by the customer form.
 * Equality is identity-based on purpose: Lombok's field-based equals/hashCode recursed through
 * the bidirectional relations.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Customer {
    /** Name stored for stall sales before the customer fills the form; never shown publicly. */
    public static final String PLACEHOLDER_NAME = "Walk-in";

    /** The real name, or "" while it is still the stall placeholder. */
    /** Name left after the personal data was deleted (data retention). */
    public static final String DELETED_NAME = "(deleted)";

    public String publicName() {
        return name == null || PLACEHOLDER_NAME.equals(name.trim()) || DELETED_NAME.equals(name.trim()) ? "" : name.trim();
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Optimistic lock: concurrent writers get 409 CONFLICT instead of overwriting each other. */
    @jakarta.persistence.Version
    private long version;

    @Column(nullable = false)
    private String name = "";
    @Column(nullable = false)
    private String email = "";
    @Column(nullable = false)
    private String phone = "";

    @OneToMany(mappedBy = "customer")
    private List<Order> orders = new ArrayList<>();
}
