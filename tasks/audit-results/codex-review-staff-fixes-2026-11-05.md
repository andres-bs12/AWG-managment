Static review of the uncommitted diff; I did not run the browser or tests.

1. **Fixed — Vienna grouping.** Deduplication now uses the ornament ID before grouping, so different ornaments in the same order survive: [DeliveriesPage.tsx:69](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:69>).

2. **Fixed — production filters.** Orders are grouped before their aggregate production status is filtered: [DeliveriesPage.tsx:211](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:211>).

3. **Fixed — undo ordering.** Positions are retained for the current filter view across handover and undo: [DeliveriesPage.tsx:144](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/DeliveriesPage.tsx:144>). Actual movement still needs browser verification.

4. **Partially fixed — autosave.** Valid drafts are tracked immediately, responses are guarded, and pending edits are sent on unmount: [PaintingDaysPage.tsx:57](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:57>), [line 74](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:74>), [line 87](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:87>). However, a failed save after leaving has no visible error or retry because the row has unmounted. Retain the pending save and its error beyond the row’s lifetime.

5. **Fixed — full Today.** The option is disabled, the handler rejects it, and an unlocked existing selection is cleared when capacity arrives: [NewSalePage.tsx:976](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/NewSalePage.tsx:976>), [line 1040](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/NewSalePage.tsx:1040>), [line 1057](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/NewSalePage.tsx:1057>).

6. **Partially fixed — mock Vienna dates.** An undated item no longer appears every Wednesday and Friday, but the new fallback invents the first such day after painting; it cannot establish the actual handoff date: [store.ts:545](</Users/andresbejarano/dev/AWG Tracking/frontend/src/api/mock/store.ts:545>). Exclude or flag undated records unless their real handoff date is available.

7. **Fixed — switch label.** The visible and accessible label now both contain “Open”; the switch state communicates whether it is on: [PaintingDaysPage.tsx:107](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:107>).

8. **Fixed — breakpoint.** Both rows now use `639px`, an allowed staff boundary: [SettingsRows.module.css:29](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/SettingsRows.module.css:29>), [design-system.md:845](</Users/andresbejarano/dev/AWG Tracking/docs/design-system.md:845>).

**New bug:** An invalid intermediate edit can be overwritten by an earlier save response. For example, while a save of `3` is in flight, clear the field; validation returns without updating `latest`, so the response restores `3` and shows “Saved,” losing the visible error state. Track *every* draft change, including invalid text, with a revision; apply a response only if its revision still matches. [PaintingDaysPage.tsx:74](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:74>), [line 94](</Users/andresbejarano/dev/AWG Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:94>).

No files were modified.

