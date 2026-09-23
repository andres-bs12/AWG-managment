package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ItemState;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class OrderItem {

        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private UUID id;

        @JoinColumn(name = "order_id")
        @ManyToOne
        private Order order;
        private ItemKind itemKind;
        private Instant startDate; //
        private Instant endDate;
        private ItemState itemState;
        private double cost;
        private LocalDate deliveryDate;
        private List<String> photos;
        private String PetName;
        private String nameInOrnament;

        @JoinColumn(name = "inventory_id")
        @OneToOne
        private Inventory inventory;

}
