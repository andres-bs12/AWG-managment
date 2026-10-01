package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.*;
import jakarta.persistence.*;
import lombok.*;
import jakarta.persistence.Id;

import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Enumerated(EnumType.STRING)
    private ItemKind itemKind;

    @Enumerated(EnumType.STRING)
    private ProductionStatus productionStatus;

    private double cost;

    @Enumerated(EnumType.STRING)
    private DeliveryKind deliveryKind;

    @JoinColumn(name = "market_id")
    @ManyToOne(fetch = FetchType.LAZY)
    private MarketDay market;

    private LocalTime pickUpHour;


    private Instant startDate; //
    private Instant endDate;

    private boolean withName;
    private String nameInOrnament;
    private String petName;

    @ElementCollection
    private List<String> photos = new ArrayList<>();

    private String note;

    @JoinColumn(name = "inventory_id")
    @ManyToOne(fetch = FetchType.LAZY)
    private Inventory inventory;

    @Enumerated(EnumType.STRING)
    private CustomColor customColor;
}
