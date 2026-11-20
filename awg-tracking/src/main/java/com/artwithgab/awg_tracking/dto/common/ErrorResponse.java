package com.artwithgab.awg_tracking.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Error body for every non-2xx response. The frontend localises by `code` and shows the error next
 * to `field` when present; `message` is the English fallback.
 *
 * Post shipping codes:
 * <ul>
 *   <li>POSTAL_INVALID (400, address.postalCode): invalid Austrian postcode.</li>
 *   <li>SHIPPING_UNAVAILABLE (409 checkout, 400 staff sale, delivery): no eligible collection
 *       and arrival window for the order.</li>
 *   <li>SHIPPING_WINDOW_CHANGED (409, delivery): the new arrival window ends after
 *       the date accepted at checkout.</li>
 *   <li>SHIPPING_NEEDS_CUSTOM (400, delivery): finished Post pieces require an enabled
 *       finished-with-custom policy and a custom Post piece in the same order.</li>
 * </ul>
 *
 * Make-room codes:
 * <ul>
 *   <li>SESSION_NOT_MOVABLE (409): the item has no movable painting session.</li>
 *   <li>NO_SLOT_KEEPS_PROMISE (409): no eligible replacement slot before the item's handoff.</li>
 *   <li>NO_MOVABLE_SESSION (409): the requested slot could not be freed. The response reason is
 *       SAME_DAY_ONLY (all sessions are for same-day pickup), NO_TARGET_SLOT (no feasible plan),
 *       or NOT_PAINTING_DAY (the date has no available painting schedule).</li>
 *   <li>IDEMPOTENCY_KEY_REUSED (409): a make-room Idempotency-Key was reused with another request body.</li>
 * </ul>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(int status, String message, String code, String field, String reason) {
}
