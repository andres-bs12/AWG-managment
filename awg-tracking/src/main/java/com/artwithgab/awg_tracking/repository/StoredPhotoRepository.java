package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.StoredPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface StoredPhotoRepository extends JpaRepository<StoredPhoto, UUID> {
    List<StoredPhoto> findByIdIn(Collection<UUID> ids);
}
