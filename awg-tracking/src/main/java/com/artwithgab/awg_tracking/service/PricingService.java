package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.dto.pricing.PricesDto;
import com.artwithgab.awg_tracking.dto.pricing.UpdatePricesRequest;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.OrnamentSize;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.model.PriceSetting;
import com.artwithgab.awg_tracking.repository.PriceSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.DayOfWeek;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Prices live on the server so a client cannot change them. Staff edit them on the Stock screen;
 * until the first save the awg.pricing.* defaults apply. Matches frontend/src/lib/money.ts.
 */
@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class PricingService {
    private final AwgProperties props;
    private final PriceSettingRepository repository;
    private final ObjectProvider<CalendarService> calendarService;
    private final Clock clock;

    /** Letters allowed in the name painted on the back until staff choose another limit. */
    public static final int DEFAULT_BACK_NAME_MAX = 5;
    /** Highest limit staff may set; request DTOs accept back names up to this length. */
    public static final int BACK_NAME_MAX_LIMIT = 20;

    @Transactional(readOnly = true)
    public PricesDto current() {
        return view(repository.findById(PriceSetting.ID).orElse(null));
    }

    private PricesDto view(PriceSetting row) {
        var defaults = props.pricing();
        List<String> days = row == null || row.getPostCollectionDays() == null
                ? props.post().collectionWeekdays().stream().map(DayOfWeek::name).toList()
                : Arrays.asList(row.getPostCollectionDays().split(","));
        List<String> weekdays = days.stream().map(day -> day.toLowerCase(Locale.ROOT)).toList();
        if (row == null) return new PricesDto(defaults.custom(), defaults.customMedium(), defaults.finished(), defaults.nameExtra(),
                defaults.shipping(), weekdays, props.post().finishedWithCustom(), DEFAULT_BACK_NAME_MAX, 0);
        return new PricesDto(row.getCustomPrice(),
                row.getCustomMediumPrice() == null ? defaults.customMedium() : row.getCustomMediumPrice(), row.getFinishedPrice(), row.getNameExtra(),
                row.getShippingFee() == null ? defaults.shipping() : row.getShippingFee(), weekdays,
                props.post().finishedWithCustom(),
                row.getBackNameMax() == null ? DEFAULT_BACK_NAME_MAX : row.getBackNameMax(), row.getRevision());
    }

    /** Current letter limit for the name painted on the back. */
    public int backNameMax() {
        return current().backNameMax();
    }

    /**
     * Normalizes a back name (trimmed, upper case) and checks it against the current limit.
     * A name equal to {@code saved} is accepted as is, so orders taken under an older, higher limit stay valid.
     */
    public String requireBackName(String raw, String saved, String field) {
        String back = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (!back.isEmpty() && back.equals(saved)) return back;
        int max = backNameMax();
        if (back.isEmpty() || back.codePointCount(0, back.length()) > max) {
            throw new BadRequestException("Use 1–" + max + " letters for the painted name.").code("VALIDATION").field(field);
        }
        return back;
    }

    /** Price of one ornament; a custom one costs its size's price (null size = big, as before sizes) plus the name. */
    public BigDecimal itemCost(ItemKind kind, OrnamentSize size, boolean withName) {
        PricesDto p = current();
        if (kind == ItemKind.GENERIC) return p.finishedPrice();
        BigDecimal base = size == OrnamentSize.MEDIUM ? p.customMediumPrice() : p.customPrice();
        return withName ? base.add(p.nameExtra()) : base;
    }

    /**
     * The size of a sold ornament; finished pieces never carry one. The current UI always sends a size.
     * A page loaded before sizes existed (an iPad or a customer's tab left open across a deploy) sends
     * none and shows the big price, so it sells a big one instead of failing the sale.
     */
    public static OrnamentSize requireSize(ItemKind kind, OrnamentSize size, String field) {
        if (kind != ItemKind.CUSTOM) return null;
        return size == null ? OrnamentSize.BIG : size;
    }

    /** The surcharge stored on a sold item, or null when it has no paid name. */
    public BigDecimal nameExtraFor(ItemKind kind, boolean withName) {
        return kind == ItemKind.CUSTOM && withName ? current().nameExtra() : null;
    }

    /** Surcharge shown on an invoice: the one charged at sale time, else the default of that era. */
    public BigDecimal chargedNameExtra(BigDecimal stored) {
        return stored != null ? stored : props.pricing().nameExtra();
    }

    @Transactional
    public PricesDto update(UpdatePricesRequest body) {
        // Same lock as sales: no sale is priced halfway through a change.
        calendarService.getObject().lockSchedule();
        PricesDto now = current();
        if (body.expectedRevision() != now.revision()) {
            throw new ConflictException("Someone changed the prices meanwhile. Check them and save again.").code("PRICES_CHANGED");
        }
        if (body.postCollectionDays().stream().distinct().count() != body.postCollectionDays().size()) {
            throw new BadRequestException("Choose distinct Post collection weekdays.")
                    .code("VALIDATION").field("postCollectionDays");
        }
        PriceSetting row = repository.findById(PriceSetting.ID).orElseGet(() -> {
            PriceSetting created = new PriceSetting();
            created.setId(PriceSetting.ID);
            return created;
        });
        row.setCustomPrice(body.customPrice());
        if (body.customMediumPrice() != null) row.setCustomMediumPrice(body.customMediumPrice());
        else if (row.getCustomMediumPrice() == null) row.setCustomMediumPrice(now.customMediumPrice());
        row.setFinishedPrice(body.finishedPrice());
        row.setNameExtra(body.nameExtra());
        row.setShippingFee(body.shippingFee());
        row.setPostCollectionDays(String.join(",", body.postCollectionDays()).toUpperCase(Locale.ROOT));
        if (body.backNameMax() != null) row.setBackNameMax(body.backNameMax());
        row.setRevision(now.revision() + 1);
        row.setUpdatedAt(clock.instant());
        repository.save(row);
        // Audit trail for price changes (no customer data): old -> new, revision.
        log.info("Prices changed to revision {}: custom big {} -> {}, custom medium {} -> {}, finished {} -> {}, name {} -> {}, back-name max {} -> {}",
                row.getRevision(), now.customPrice(), body.customPrice(), now.customMediumPrice(), body.customMediumPrice(), now.finishedPrice(), body.finishedPrice(),
                now.nameExtra(), body.nameExtra(), now.backNameMax(), row.getBackNameMax() == null ? now.backNameMax() : row.getBackNameMax());
        return view(row);
    }
}
