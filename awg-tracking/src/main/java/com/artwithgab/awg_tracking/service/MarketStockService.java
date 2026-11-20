package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MarketStockService {
    private static final int MAX_PHOTO_BYTES = 1024 * 1024;
    private static final String SUMMARY = "SELECT id, status, sold_at, revision, photo IS NOT NULL AS has_photo FROM market_ornament";
    private static final RowMapper<Ornament> ORNAMENT = (row, index) -> {
        var soldAt = row.getObject("sold_at", OffsetDateTime.class);
        return new Ornament(row.getString("id"), row.getString("status"),
                soldAt == null ? null : soldAt.toInstant(), row.getInt("revision"), row.getBoolean("has_photo"));
    };

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public record Ornament(String id, String status, Instant soldAt, int revision, boolean hasUploadedPhoto) {}

    public List<Ornament> list() {
        return jdbc.query(SUMMARY + " ORDER BY id", ORNAMENT);
    }

    public String photo(String id) {
        return jdbc.query("SELECT photo FROM market_ornament WHERE id = ?", row -> {
            if (!row.next()) throw new ResourceNotFoundException("Ornament not found.");
            byte[] photo = row.getBytes("photo");
            return photo == null ? null : "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(photo);
        }, id);
    }

    @Transactional
    public Ornament changeStatus(String id, String status, int revision) {
        Ornament current = find(id);
        requireCurrent(current.revision() == revision);
        if (current.status().equals(status)) return current;
        if (("sold".equals(status) && !"painted".equals(current.status()))
                || ("sold".equals(current.status()) && !"painted".equals(status))) {
            throw new BadRequestException("Only a painted ornament can be sold. Undo the sale before changing its paint status.");
        }
        var soldAt = "sold".equals(status) ? OffsetDateTime.now(clock) : null;
        int updated = jdbc.update("""
                UPDATE market_ornament SET status = ?, sold_at = ?, revision = revision + 1
                WHERE id = ? AND revision = ?
                """, status, soldAt, id, revision);
        requireCurrent(updated == 1);
        return find(id);
    }

    @Transactional
    public Ornament savePhoto(String id, MultipartFile file, int revision) {
        requireCurrent(find(id).revision() == revision);
        if (file.isEmpty() || file.getSize() > MAX_PHOTO_BYTES) {
            throw new BadRequestException("Use a JPEG photo of 1 MB or less.");
        }
        byte[] photo;
        try {
            photo = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("The photo could not be read. Try again.");
        }
        String[] type = PhotoStorageService.detect(photo);
        if (type == null || !"image/jpeg".equals(type[0])) {
            throw new BadRequestException("Use a JPEG photo.");
        }
        PhotoStorageService.checkDecodable(file, type[0]);
        int updated = jdbc.update("""
                UPDATE market_ornament SET photo = ?, revision = revision + 1
                WHERE id = ? AND revision = ?
                """, photo, id, revision);
        requireCurrent(updated == 1);
        return find(id);
    }

    private Ornament find(String id) {
        return jdbc.query(SUMMARY + " WHERE id = ?", ORNAMENT, id).stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Ornament not found."));
    }

    private static void requireCurrent(boolean current) {
        if (!current) {
            throw new ConflictException("Someone else updated this ornament. Check the current details and try again.")
                    .code("MARKET_STOCK_CHANGED");
        }
    }
}
