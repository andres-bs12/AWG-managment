package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * Stock. CUSTOM rows are tracked per raw color; GENERIC (finished) stock is one global row
 * with a null color. See docs/contracts-and-dtos.md §4.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class Inventory {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Enumerated(EnumType.STRING)
    private CustomColor customColor;
    private int quantity;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItemKind itemKind;
}
