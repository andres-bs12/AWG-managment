package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.OrderState;
import com.artwithgab.awg_tracking.enums.PaymentState;
import jakarta.persistence.*;
import lombok.*;
import jakarta.persistence.Id;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode

public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(unique = true)
    private UUID id;

    @Column(unique = true)
    private String code; // links

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> orderItems = new ArrayList<>();

    private double total;

    @Enumerated(EnumType.STRING)
    private PaymentState paymentState;

    private Boolean handedOver;

    @Column(name = "form_token", nullable = false, unique = true)
    private String formToken;

    @Column(name = "track_token", nullable = false, unique = true)
    private String trackToken;

    @JoinColumn(name = "customer_id", nullable = false)
    @ManyToOne
    private Customer customer;

    private String deliveryAddress;
}
