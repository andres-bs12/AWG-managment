package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.BuyMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BuyMetricRepository extends JpaRepository<BuyMetric, Long> {
    Optional<BuyMetric> findByDateAndEventAndStepAndFieldAndValue(LocalDate date, String event, String step, String field, String value);
    List<BuyMetric> findByDateBetweenOrderByDateAsc(LocalDate from, LocalDate to);
}
