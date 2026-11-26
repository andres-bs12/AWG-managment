package com.artwithgab.awg_tracking.dto.order;

import com.artwithgab.awg_tracking.dto.agenda.MoveSuggestionDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Mirrors `CreateSaleInput`. Customer fields are optional: the customer form collects them. */
public record CreateSaleRequest(
        MoveSuggestionDto plannedMove,
        @Size(max = 120) String customerName,
        @Size(max = 40) String phone,
        @Email @Size(max = 200) String email,
        @NotEmpty(message = "Add at least one ornament") @Size(max = 20) @Valid List<CreateSaleItemRequest> items,
        UUID soldOnMarketDayId,
        /** Optional discounted total actually charged (e.g. 3 × 35 € sold for 90 €). Null keeps the list price. */
        @DecimalMin(value = "0.00", message = "The price can't be negative") @Digits(integer = 8, fraction = 2) BigDecimal chargedTotal
) {
}
