package com.artwithgab.awg_tracking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;

@Entity
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"metric_date", "event", "step", "field", "metric_value"}))
@Getter @Setter @NoArgsConstructor
public class BuyMetric {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "metric_date", nullable = false) private LocalDate date;
    @Column(nullable = false, length = 32) private String event;
    @Column(nullable = false, length = 32) private String step = "";
    @Column(nullable = false, length = 32) private String field = "";
    @Column(name = "metric_value", nullable = false, length = 32) private String value = "";
    @Column(nullable = false) private long count;
}
