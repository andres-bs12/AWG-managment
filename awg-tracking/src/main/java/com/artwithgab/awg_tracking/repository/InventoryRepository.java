package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface InventoryRepository extends JpaRepository<Inventory, UUID> {
}
