package com.artwithgab.awg_tracking.repository;

import com.artwithgab.awg_tracking.model.MarketOrnament;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface MarketOrnamentRepository extends JpaRepository<MarketOrnament, String> {
    /** Avoid fetching several MB of photo bytes per row in the stock list. */
    interface Summary {
        String getId();
        String getStatus();
        Instant getSoldAt();
        int getRevision();
        boolean getHasUploadedPhoto();
    }

    @Query("select m.id as id, m.status as status, m.soldAt as soldAt, m.revision as revision, " +
            "(m.photo is not null) as hasUploadedPhoto from MarketOrnament m order by m.id")
    List<Summary> summaries();

    @Query("select m.id as id, m.status as status, m.soldAt as soldAt, m.revision as revision, " +
            "(m.photo is not null) as hasUploadedPhoto from MarketOrnament m where m.id = :id")
    Optional<Summary> summary(String id);

    @Modifying(flushAutomatically = true)
    @Query("update MarketOrnament m set m.status = :status, m.revision = m.revision + 1 " +
            "where m.id = :id and m.revision = :revision and m.status <> 'sold'")
    int changeStatus(String id, String status, int revision);

    @Modifying(flushAutomatically = true)
    @Query("update MarketOrnament m set m.photo = :photo, m.revision = m.revision + 1 " +
            "where m.id = :id and m.revision = :revision and m.status <> 'sold'")
    int savePhoto(String id, byte[] photo, int revision);

    /** Atomic even when a caller does not hold the schedule lock. */
    @Modifying(flushAutomatically = true)
    @Query("update MarketOrnament m set m.status = 'sold', m.soldAt = :soldAt, m.revision = m.revision + 1 " +
            "where m.id = :id and m.status = 'painted'")
    int sellPainted(String id, Instant soldAt);

    @Modifying(flushAutomatically = true)
    @Query("update MarketOrnament m set m.status = 'painted', m.soldAt = null, m.revision = m.revision + 1 " +
            "where m.id = :id and m.status = 'sold'")
    int returnSold(String id);
}
