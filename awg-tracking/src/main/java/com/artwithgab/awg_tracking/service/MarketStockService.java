package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.exception.ApiException;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.MarketOrnament;
import com.artwithgab.awg_tracking.repository.MarketOrnamentRepository;
import com.artwithgab.awg_tracking.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MarketStockService {
    private static final int MAX_PHOTO_BYTES = 5 * 1024 * 1024;
    private final MarketOrnamentRepository ornaments;
    private final OrderItemRepository items;
    private final Clock clock;

    public record Ornament(String id, String status, Instant soldAt, int revision, boolean hasUploadedPhoto,
                           String orderId, String orderCode) {}

    @Transactional(readOnly = true)
    public List<Ornament> list() {
        var stock = ornaments.summaries();
        // One batch query for current orders; cancelled links remain as history, never duplicate rows.
        Map<String, OrderItemRepository.MarketSale> sales = items.activeMarketSales().stream()
                .collect(Collectors.toMap(OrderItemRepository.MarketSale::getMarketOrnamentId, Function.identity()));
        return stock.stream().map(m -> view(m, sales.get(m.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public String photo(String id) {
        byte[] photo = ornaments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Ornament not found.")).getPhoto();
        return photo == null ? null : "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(photo);
    }

    @Transactional
    public Ornament changeStatus(String id, String status, int revision) {
        var current = find(id);
        requireEditable(current, revision, status);
        if (current.getStatus().equals(status)) return view(current, null);
        if (!"unpainted".equals(status) && !"painted".equals(status)) {
            throw new BadRequestException("Choose unpainted or painted.").code("VALIDATION").field("status");
        }
        requireCurrent(ornaments.changeStatus(id, status, revision) == 1);
        return view(find(id), null);
    }

    @Transactional
    public Ornament savePhoto(String id, MultipartFile file, int revision) {
        var current = find(id);
        requireEditable(current, revision, null);
        if (file.isEmpty() || file.getSize() > MAX_PHOTO_BYTES) {
            throw new BadRequestException("Use a JPEG photo of 5 MB or less.");
        }
        byte[] photo;
        try {
            photo = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("The photo could not be read. Try again.");
        }
        if (photo.length > MAX_PHOTO_BYTES) throw new BadRequestException("Use a JPEG photo of 5 MB or less.");
        String[] type = PhotoStorageService.detect(photo);
        if (type == null || !"image/jpeg".equals(type[0])) throw new BadRequestException("Use a JPEG photo.");
        PhotoStorageService.checkDecodable(file, type[0]);
        requireCurrent(ornaments.savePhoto(id, photo, revision) == 1);
        return view(find(id), null);
    }

    /** Called in the sale transaction, under ScheduleLock; the conditional write also guards races. */
    @Transactional
    public MarketOrnament sell(String id) {
        if (ornaments.sellPainted(id, clock.instant()) != 1) {
            var current = find(id);
            if ("sold".equals(current.getStatus())) {
                throw new ConflictException("This ornament was already sold.").code("MARKET_STOCK_SOLD");
            }
            throw new ConflictException("This ornament is not painted yet.").code("MARKET_STOCK_NOT_READY");
        }
        return ornaments.getReferenceById(id);
    }

    @Transactional
    public void returnSold(String id) {
        ornaments.returnSold(id);
    }

    private MarketOrnamentRepository.Summary find(String id) {
        return ornaments.summary(id).orElseThrow(() -> new ResourceNotFoundException("Ornament not found."));
    }

    private static Ornament view(MarketOrnamentRepository.Summary m, OrderItemRepository.MarketSale sale) {
        boolean linked = "sold".equals(m.getStatus()) && sale != null;
        return new Ornament(m.getId(), m.getStatus(), m.getSoldAt(), m.getRevision(), m.getHasUploadedPhoto(),
                linked ? sale.getOrderId().toString() : null, linked ? sale.getOrderCode() : null);
    }

    private static void requireEditable(MarketOrnamentRepository.Summary current, int revision, String target) {
        if ("sold".equals(target)) throw sellInSale();
        requireCurrent(current.getRevision() == revision);
        if ("sold".equals(current.getStatus())) throw sellInSale();
    }

    private static ApiException sellInSale() {
        return new BadRequestException("Sell ornaments through New sale. Cancel the order to return a sold ornament.")
                .code("MARKET_STOCK_SELL_IN_SALE");
    }

    private static void requireCurrent(boolean current) {
        if (!current) throw new ConflictException("Someone else updated this ornament. Check the current details and try again.")
                .code("MARKET_STOCK_CHANGED");
    }
}
