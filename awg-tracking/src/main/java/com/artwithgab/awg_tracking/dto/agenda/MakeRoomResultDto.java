package com.artwithgab.awg_tracking.dto.agenda;

import com.artwithgab.awg_tracking.dto.common.HourSpanDto;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MakeRoomResultDto(HourSpanDto slot, List<Move> moved) {
    public record Move(String itemId, String orderCode, HourSpanDto from, HourSpanDto to) {
    }
}
