# Staff UX review

**The claim that every P0 and P1 is fixed is not yet supported.** The finished-item sale’s original mock failure is fixed in code, but I found remaining P1 problems in delivery grouping, handover ordering, painting-day autosave, and the “Today full” flow. I found no new P0.

This is a static, read-only review of `0a891f5..HEAD`. I did not run the browser or tests. Visual layout, actual focus and screen-reader announcements therefore remain **unverified in a browser**.

## P1 findings

### 1. Vienna multi-ornament orders still lose items in the default view

[DeliveriesPage.tsx:69](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:69>) discards every Vienna row after the first row for an order before [groupOrders](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:53>) runs.

**Scenario:** In “Today & upcoming,” a Vienna order with two ornaments displays only the first. If that ornament is finished and the other is not, the row looks ready; the later bundle check prevents handover, but the worker cannot see the missing ornament or why the action fails. This leaves agenda audit P1-3 unresolved for the default Vienna view.

**Minimal fix:** Deduplicate only repeated *item/date* records where necessary, then group all items for each order and handoff date. Test both the default view and a selected day.

### 2. Production filters remove items before order readiness is calculated

[DeliveriesPage.tsx:190](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:190>) filters individual items by production status before grouping them.

**Scenario:** An order containing one finished and one unfinished ornament appears under “Finished” as a single finished ornament. Its action is enabled even though the complete order cannot be handed over. The bundle check rejects it, but the list hides the reason.

**Minimal fix:** Build complete order groups first; apply the filter to those groups while retaining every item for names, count and readiness.

### 3. Undo handover can move a different button under the user’s finger

[DeliveriesPage.tsx:180](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:180>) pins an order *before* the operation, while [the sort](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:268>) treats a pinned handed-over row like an active row.

**Scenario:** A handed-over order is initially at the bottom. Tapping “Undo handover” immediately pins it, moving it into the active portion of the list before the request finishes. Another action may occupy the same location—the same class of double-tap hazard identified in agenda audit P1-2. Browser verification is needed to measure the actual movement.

**Minimal fix:** Snapshot and preserve the displayed row order for the current filter set, including when undoing; update the row’s state without recomputing its position.

### 4. Painting-day autosave can show stale values and lose edits

[PaintingDaysPage.tsx:60](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:60>) clears the debounce timer on unmount; [lines 70–86](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:70>) also distinguish queued changes only after the timer fires.

**Scenarios:**

- Type a new maximum and navigate or change the four-week range within 400 ms: cleanup cancels the timer, so the displayed edit is never sent.
- While a save is in flight, type another value. If the first response arrives before the second debounce expires, `pending.current` is still empty, so the response overwrites the newer visible input. The timer can subsequently save the newer value while the UI continues to show the older value.

This weakens the autosave replacement for agenda audit P1-9.

**Minimal fix:** Track the latest draft immediately, separately from the in-flight request, and only apply a response when it still matches that draft. Flush or explicitly retain pending edits across navigation/range changes and provide recovery for failed saves.

### 5. “Today · full” remains selectable and can return to the dead end

[NewSalePage.tsx:1035](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/NewSalePage.tsx:1035>) accepts `today` even when `todayFull` is set; [the option](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/NewSalePage.tsx:1053>) is labelled full but is not disabled.

**Scenario:** After the form opens the market-day picker because today is full, the worker selects “Today · full.” The handler sets today as the pickup date and closes the picker, allowing the same unplannable path again. Existing drafts or an item added before capacity data loads can also retain today as the selected date. Thus sale audit P1-2 is only partially fixed.

**Minimal fix:** Disable or reject the full Today choice and reconcile an existing same-day selection when the capacity data arrives. Explain that the limit concerns automatic planning if manual sales can exceed it.

## P2 findings

### 6. Mock Vienna dates can still differ from HTTP

[store.ts:550](</Users/andresbejarano/dev/AWG Tracking/frontend/src/api/mock/store.ts:550>) assigns a Vienna item with neither `marketDayId` nor `deliveryDate` to **every Wednesday and Friday**. The backend only includes an item on its actual `handoffDate` ([AgendaService.java:115](</Users/andresbejarano/dev/AWG Tracking/awg-tracking/src/main/java/com/artwithgab/awg_tracking/service/AgendaService.java:115>)).

**Scenario:** Legacy or incomplete mock data can appear on multiple days and acquire a misleading date label. The new backend `methodLabel` itself correctly formats the date used to select the item; the mock fallback does not establish that date.

**Minimal fix:** Derive one actual handoff date using the same domain rule as the backend, or explicitly exclude/flag records without a determinable date.

### 7. Closed painting-day switch fails label-in-name

[PaintingDaysPage.tsx:93](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:93>) displays “Closed” but overrides its accessible name with “Painting open [date].”

**Scenario:** A speech-input user seeing “Closed” cannot reliably activate the control by its visible label; the accessible name also describes the opposite visible state. This conflicts with WCAG 2.5.3.

**Minimal fix:** Keep a stable visible and accessible label such as “Painting open, [date]” and expose on/off through the switch state; alternatively include the visible state text in the accessible name.

### 8. New breakpoints depart from the documented staff design system

[SettingsRows.module.css:29](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/SettingsRows.module.css:29>) and line 35 introduce `599px`, whereas the [staff design system](</Users/andresbejarano/dev/AWG Tracking/docs/design-system.md:845>) specifies the allowed breakpoint boundaries.

**Scenario:** Stock and painting-day layouts switch at an undocumented width, making the shared responsive contract inconsistent.

**Minimal fix:** Use an approved boundary, or document and centrally approve the new breakpoint. The changed staff styles otherwise largely use existing tokens; a complete visual spacing and contrast assessment needs a browser.

## Audit-claim disposition

| Audit item | Static assessment |
|---|---|
| Sale P0-1 | Root cause fixed: mock finished items are created as finished; the unrelated retry control is suppressed. The added mock E2E covers the reported path, but I did not run it. |
| Sale P1-1 | CSS specificity fix is present for 56 px large staff buttons. Actual sizes across screens need browser verification. |
| Sale P1-2 | **Partial:** the hint and default picker exist, but Today remains selectable when full; see finding 5. |
| Sale P1-3 | “Show QR again” returns from payment to the existing QR phase without creating another order. The audit also requested a QR on the done screen; that addition is not established by this fix. |
| Sale P1-4 | The new-sale action after order creation opens an explicit dialog with keep working, open order and start new sale. QR/payment path is covered statically; other navigation paths and focus need browser verification. |
| Sale P1-5 | Existing payment method is preselected and the risky action is visually demoted in code. Actual visual hierarchy needs browser verification. |
| Sale P1-6 | Cancel order is demoted in the order-detail changes; visual hierarchy needs browser verification. |
| Sale P1-7 | Pending/review order presentation and actions are guarded in code and covered by an HTTP fixture test; real backend/browser behaviour remains unverified. |
| Agenda P1-1 | Card/action wrapper spacing is added; the actual proximity needs browser verification. |
| Agenda P1-2 | **Partial:** normal handover pins a row, but undo can reorder it; see finding 3. |
| Agenda P1-3 | **Not fully fixed:** default Vienna view and production filters still hide items; see findings 1–2. |
| Agenda P1-4 | Backend date label and date sections are implemented. Mock records without a definite date remain unreliable; see finding 6. |
| Agenda P1-5 | Move error is rendered inside the open dialog. |
| Agenda P1-6 | Compact slots and text-scaled geometry are implemented. Clipping, dynamic text-size changes and zoom require browser verification. |
| Agenda P1-7 | Error is placed near Save and focused; date matching marks a conflicting row. Browser focus and scroll behaviour remain unverified. |
| Agenda P1-8 | Day action is changed to a quiet “Remove” action and the input override is removed. Visual hierarchy needs browser verification. |
| Agenda P1-9 | Compact rows, past-day hiding, warning and autosave are present, but autosave is unsafe under the conditions in finding 4. |
| Agenda P1-10 | Header distinguishes session count from the web-booking cap in code. |

## E2E coverage gaps

The added tests in [staff-review.spec.ts](</Users/andresbejarano/dev/AWG Tracking/frontend/e2e/staff-review.spec.ts:685>) exercise the principal happy paths, but they do not establish several claims:

- The [handover test](</Users/andresbejarano/dev/AWG Tracking/frontend/e2e/staff-review.spec.ts:471>) has one delivery row, so it cannot prove ordering is stable or detect a different button moving under a finger. Add multiple ready orders and test handover **and undo**, including cancellation and failure.
- The [painting-day test](</Users/andresbejarano/dev/AWG Tracking/frontend/e2e/staff-review.spec.ts:738>) waits for each save before the next action. Add delayed and failed responses, rapid edits, invalid intermediate input, and navigation during the debounce.
- The fixture supplies one market delivery per order ([line 71](</Users/andresbejarano/dev/AWG Tracking/frontend/e2e/staff-review.spec.ts:71>)). Add multi-item market and Vienna orders, mixed production states, different dates, and each production filter.
- Add a full-today test that explicitly selects “Today · full,” plus a capacity response arriving after the draft was created.
- The [200% text test](</Users/andresbejarano/dev/AWG Tracking/frontend/e2e/staff-review.spec.ts:758>) checks one initial slot at a preconfigured root size. Add short and overlapping slots, long names, runtime text-size changes and actual browser zoom.
- Test the leave-sale dialog’s **Open order** and **Start new sale** actions, focus restoration, and QR recovery after payment completion. Axe checks alone cannot establish target spacing, meaningful announcements or label-in-name in every state.

No files were modified.

