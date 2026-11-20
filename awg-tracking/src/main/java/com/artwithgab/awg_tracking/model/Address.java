package com.artwithgab.awg_tracking.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Shipping or legacy Vienna delivery address. Lives on Order (one address per order). */
@Embeddable
@Getter
@EqualsAndHashCode
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Address {
    @Column(name = "address_line1")
    private String line1;
    @Column(name = "address_line2")
    private String line2;
    @Column(name = "address_city")
    private String city;
    @Column(name = "address_postal_code")
    private String postalCode;
}
