package com.artwithgab.awg_tracking.dto.pricing;

import java.math.BigDecimal;
import java.util.List;

/**
 * Current prices, the back-name letter limit and the read-only Post eligibility flag.
 * Revision 0 means server defaults.
 */
public record PricesDto(BigDecimal customPrice, BigDecimal finishedPrice, BigDecimal nameExtra,
                        BigDecimal shippingFee, List<String> postCollectionDays, boolean finishedWithCustom,
                        int backNameMax, long revision) {
}
