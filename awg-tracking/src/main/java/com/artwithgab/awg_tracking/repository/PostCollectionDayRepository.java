package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.PostCollectionDay;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface PostCollectionDayRepository extends JpaRepository<PostCollectionDay, LocalDate> {
}
