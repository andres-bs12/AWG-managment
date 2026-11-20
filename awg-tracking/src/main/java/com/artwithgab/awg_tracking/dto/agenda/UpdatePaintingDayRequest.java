package com.artwithgab.awg_tracking.dto.agenda;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

/** Staff update for painting availability and hours; maxPaintings is accepted for legacy clients and ignored. */
@Getter
@Setter
public class UpdatePaintingDayRequest {
    private Boolean open;
    private Integer maxPaintings;
    private Double openHour;
    private Double closeHour;
    private UUID paintingMarketId;
    @JsonIgnore
    @Setter(AccessLevel.NONE)
    private boolean paintingMarketSpecified;

    @JsonSetter
    public void setPaintingMarketId(UUID marketId) {
        paintingMarketId = marketId;
        paintingMarketSpecified = true;
    }
}
