package com.artwithgab.awg_tracking.dto.market;

import java.util.List;

public record SaveMarketResponse(MarketDto market, List<MarketDayDto> days) {
}
