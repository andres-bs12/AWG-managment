package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.PriceSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PriceSettingRepository extends JpaRepository<PriceSetting, Long> {
}
