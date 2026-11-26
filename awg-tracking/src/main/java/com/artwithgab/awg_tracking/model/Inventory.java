package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.ItemKind;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * Stock. CUSTOM rows are tracked per raw color, finish and size (Big 10 cm / Medium 8 cm); GENERIC (finished) stock is one global row
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
    @Enumerated(EnumType.STRING)
    private CustomFinish customFinish;
    /** CUSTOM bases are counted per size too (V22); null for the GENERIC row. */
    @Enumerated(EnumType.STRING)
    @Column(name = "ornament_size", length = 16)
    private com.artwithgab.awg_tracking.enums.OrnamentSize ornamentSize;
    private int quantity;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItemKind itemKind;
}
