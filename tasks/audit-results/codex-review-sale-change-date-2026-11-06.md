No P0 found. Static review only; no files modified or tests run.

- **P1 — Changing date can erase a committed payment.** `frontend/src/pages/staff/NewSalePage.tsx:547`: if recording payment commits but its response is lost, the page remains at payment with “Change date” available. Cancellation deletes that paid order; recreation starts unpaid, losing the payment record and risking double collection. Check authoritative payment state before allowing this flow.

- **P1 — Previously applied `plannedMove` survives cancellation.** `frontend/src/pages/staff/NewSalePage.tsx:558`: clearing the draft’s `plannedMove` does not undo the other order’s rescheduling. `OrderService.java:251` already persisted that move; cancellation only deletes/restocks the new sale (`:343–360`). Changing this sale’s date therefore leaves another customer’s painting session moved without warning.

- **P2 — Availability stays stale across staff refreshes.** `frontend/src/pages/staff/NewSalePage.tsx:1442`: the preview key excludes the refresh version and current time. If another device frees a slot, previously disabled hours remain disabled even after the page’s periodic refresh. Conversely, an enabled hour can advertise painting time that is now occupied or past.

- **P2 — Preview disables hours the move planner could accommodate.** `frontend/src/pages/staff/NewSalePage.tsx:1431`: a failed capacity check immediately marks an hour unavailable, whereas the real planner subsequently calls `findMoveSuggestion` (`:267`). With no hour selected and capacity exhausted, all buttons become disabled, preventing selection from reaching the existing “one change makes room” flow.

- **P2 — Destructive confirmation is enabled before customer-state lookup finishes.** `frontend/src/pages/staff/NewSalePage.tsx:647`: the customer-form warning is absent while `formSent` is unknown, yet confirmation is enabled. On a slow/failed lookup—or a submission after the lookup—staff can delete submitted details/photos and trigger the configured cancellation notification without seeing that warning. Unknown state needs an explicit warning or a guarded confirmation.

- **P2 — Lost cancellation response leaves a dead order in the draft.** `frontend/src/pages/staff/NewSalePage.tsx:547`: if deletion commits but the response is lost, the catch preserves the old order and QR. Retrying cancellation returns 404, so the intended return to delivery never occurs. Reconcile whether the order still exists before treating the operation as failed.

- **P2 — Hover hint cannot be hovered or inspected on touch for disabled hours.** `frontend/src/pages/staff/NewSalePage.tsx:1284`: moving the pointer from an unselected hour to its hint clears the hint because it sits outside `.hours` (hoverable-content accessibility issue). Disabled buttons also cannot receive keyboard focus, and their wrapper only supplies mouse hover/`title`, leaving iPad users without the per-hour explanation. Provide persistent or explicitly selectable explanations.

