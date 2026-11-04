package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
}
