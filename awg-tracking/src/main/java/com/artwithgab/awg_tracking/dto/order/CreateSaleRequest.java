package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.dto.agenda.MoveSuggestionDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Mirrors `CreateSaleInput`. Customer fields are optional: the customer form collects them. */
public record CreateSaleRequest(
        MoveSuggestionDto plannedMove,
        @Size(max = 120) String customerName,
        @Size(max = 40) String phone,
        @Email @Size(max = 200) String email,
        @NotEmpty(message = "Add at least one ornament") @Size(max = 20) @Valid List<CreateSaleItemRequest> items
) {
}
