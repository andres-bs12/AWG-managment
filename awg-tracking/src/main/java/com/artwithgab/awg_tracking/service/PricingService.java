package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.dto.pricing.PricesDto;
import com.artwithgab.awg_tracking.dto.pricing.UpdatePricesRequest;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.model.PriceSetting;
import com.artwithgab.awg_tracking.repository.PriceSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;

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

    @Transactional(readOnly = true)
    public PricesDto current() {
        return repository.findById(PriceSetting.ID)
                .map(row -> new PricesDto(row.getCustomPrice(), row.getFinishedPrice(), row.getNameExtra(), row.getRevision()))
                .orElseGet(() -> {
                    var p = props.pricing();
                    return new PricesDto(p.custom(), p.finished(), p.nameExtra(), 0);
                });
    }

    public BigDecimal itemCost(ItemKind kind, boolean withName) {
        PricesDto p = current();
        if (kind == ItemKind.GENERIC) return p.finishedPrice();
        return withName ? p.customPrice().add(p.nameExtra()) : p.customPrice();
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
        PriceSetting row = repository.findById(PriceSetting.ID).orElseGet(() -> {
            PriceSetting created = new PriceSetting();
            created.setId(PriceSetting.ID);
            return created;
        });
        row.setCustomPrice(body.customPrice());
        row.setFinishedPrice(body.finishedPrice());
        row.setNameExtra(body.nameExtra());
        row.setRevision(now.revision() + 1);
        row.setUpdatedAt(clock.instant());
        repository.save(row);
        // Audit trail for price changes (no customer data): old -> new, revision.
        log.info("Prices changed to revision {}: custom {} -> {}, finished {} -> {}, name {} -> {}", row.getRevision(),
                now.customPrice(), body.customPrice(), now.finishedPrice(), body.finishedPrice(), now.nameExtra(), body.nameExtra());
        return new PricesDto(row.getCustomPrice(), row.getFinishedPrice(), row.getNameExtra(), row.getRevision());
    }
}
