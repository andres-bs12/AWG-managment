package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.StoredPhoto;
import com.artwithgab.awg_tracking.repository.StoredPhotoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.Arrays;
import java.util.UUID;

/**
 * Stores reference photos on local disk. The type is detected from the file's magic bytes
 * (the client's Content-Type and file name are never trusted) and the file name on disk is random.
 */
@Service
@RequiredArgsConstructor
public class PhotoStorageService {
    private final AwgProperties props;
    private final StoredPhotoRepository photoRepository;
    private final Clock clock;

    public record PhotoFile(Path path, String contentType) {
    }

    public StoredPhoto store(MultipartFile file, UUID orderItemId, String displayName) {
        if (file.isEmpty()) throw new BadRequestException("A photo is empty. Add it again.");
        if (file.getSize() > props.uploads().maxBytes()) {
            throw new BadRequestException("Each photo must be " + (props.uploads().maxBytes() / (1024 * 1024)) + " MB or smaller.");
        }
        byte[] head = new byte[16];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.readNBytes(head, 0, head.length);
        } catch (IOException e) {
            throw new BadRequestException("A photo could not be read. Add it again.");
        }
        String[] type = detect(Arrays.copyOf(head, read));
        if (type == null) throw new BadRequestException("Photos must be JPEG, PNG, WebP or HEIC images.");

        String key = UUID.randomUUID() + "." + type[1];
        try {
            Path dir = root();
            Files.createDirectories(dir);
            file.transferTo(dir.resolve(key));
        } catch (IOException e) {
            throw new IllegalStateException("Could not store photo", e);
        }
        StoredPhoto photo = new StoredPhoto();
        photo.setOriginalName(sanitizeName(displayName != null ? displayName : file.getOriginalFilename()));
        photo.setContentType(type[0]);
        photo.setSizeBytes(file.getSize());
        photo.setStorageKey(key);
        photo.setOrderItemId(orderItemId);
        photo.setCreatedAt(clock.instant());
        return photoRepository.save(photo);
    }

    public PhotoFile load(UUID id) {
        StoredPhoto photo = photoRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Photo not found"));
        Path path = root().resolve(photo.getStorageKey()).normalize();
        if (!path.startsWith(root()) || !Files.isRegularFile(path)) throw new ResourceNotFoundException("Photo not found");
        return new PhotoFile(path, photo.getContentType());
    }

    public void delete(StoredPhoto photo) {
        try {
            Files.deleteIfExists(root().resolve(photo.getStorageKey()).normalize());
        } catch (IOException ignored) {
            // Orphan file on disk is harmless; the row is removed anyway.
        }
        photoRepository.delete(photo);
    }

    /** Removes only the file on disk (used when the surrounding transaction rolls back). */
    public void deleteFile(StoredPhoto photo) {
        try {
            Files.deleteIfExists(root().resolve(photo.getStorageKey()).normalize());
        } catch (IOException ignored) {
            // Best effort.
        }
    }

    private Path root() {
        return Path.of(props.uploads().dir()).toAbsolutePath().normalize();
    }

    /** Returns {contentType, extension} or null. */
    static String[] detect(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return new String[]{"image/jpeg", "jpg"};
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return new String[]{"image/png", "png"};
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return new String[]{"image/webp", "webp"};
        }
        if (b.length >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') {
            String brand = new String(b, 8, 4, java.nio.charset.StandardCharsets.US_ASCII);
            if (brand.startsWith("hei") || brand.startsWith("hev") || brand.equals("mif1") || brand.equals("msf1")) return new String[]{"image/heic", "heic"};
        }
        return null;
    }

    static String sanitizeName(String name) {
        if (name == null || name.isBlank()) return "photo";
        String clean = name.replaceAll("[\\p{Cntrl}/\\\\]", "").trim();
        return clean.length() > 120 ? clean.substring(0, 120) : clean;
    }
}
