package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.OrderState;
import com.artwithgab.awg_tracking.enums.PaymentState;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @JoinColumn(name = "customer_id", nullable = false)
    @ManyToOne
    private Customer customer;

    @JoinColumn(name = "order_item_id", nullable = false)
    @OneToMany
    private OrderItem orderItem;
    private double total;
    private PaymentState paymentState;
    private OrderState orderState;

    @JoinColumn(name = "market_id", nullable = false)
    @OneToOne
    private Market market;

}
