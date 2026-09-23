package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.CustomColor;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.util.UUID;


@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class Inventory {
        @Id
        @GeneratedValue(strategy = GenerationType.AUTO)
        private UUID id;
        private CustomColor customColor;
        private int quantity;
        private int size;
}
