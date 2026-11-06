package com.artwithgab.awg_tracking.dto.agenda;

import com.artwithgab.awg_tracking.dto.common.HourSpanDto;

/** Mirrors `MoveSuggestion`: move block `blockId` from `from` to `to` to free `freedSlot` for a new sale. */
public record MoveSuggestionDto(String blockId, String orderCode, String title, HourSpanDto from, HourSpanDto to, HourSpanDto freedSlot) {
}
