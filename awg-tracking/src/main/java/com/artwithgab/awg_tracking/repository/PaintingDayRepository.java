package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.PaintingDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface PaintingDayRepository extends JpaRepository<PaintingDay, LocalDate> {
    List<PaintingDay> findByDateBetween(LocalDate from, LocalDate to);
}
