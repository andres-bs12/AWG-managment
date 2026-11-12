package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.config.AwgProperties;
import com.artwithgab.awg_tracking.enums.ItemKind;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/** Prices live on the server so a client cannot change them. Matches frontend/src/lib/money.ts. */
@Service
@RequiredArgsConstructor
public class PricingService {
    private final AwgProperties props;

    public BigDecimal itemCost(ItemKind kind, boolean withName) {
        var p = props.pricing();
        if (kind == ItemKind.GENERIC) return p.finished();
        return withName ? p.custom().add(p.nameExtra()) : p.custom();
    }
}
