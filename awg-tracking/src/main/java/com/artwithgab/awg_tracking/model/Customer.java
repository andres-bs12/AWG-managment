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
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name = "";
    @Column(nullable = false)
    private String email = "";
    @Column(nullable = false)
    private String phone = "";

    @OneToMany(mappedBy = "customer")
    private List<Order> orders = new ArrayList<>();
}
