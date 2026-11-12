# Public form vertical rhythm — 2026-11-07

Implementation finished locally; **partial: browser/E2E and fresh visual review remain for Claude**. Incoming E2E is green per owner. No commit. Existing staged/unstaged work retained.

Reviewed the supplied 390×844 real-phone contact sheets (`scratchpad/real-sheet-{0,1,2}.png` under the supplied Claude session path). No browser was launched here.

## Rhythm

- Label/hint → control: `--space-2` (8px), with label → hint `--space-1` (4px), retained in Field.
- Field → field and last step content → action bar: `--space-5` (24px).
- Section → section: `--space-6` (32px total). Shared `PublicForm.dividedSection` centres a decorative 1px line inside that gap; the line contributes no layout height. The owner request supersedes the old 32 + 1 + 24 rule in `docs/design-system.md`.
- Section heading → content and card → card: `--space-4` (16px).
- Compact review details/photo grouping: `--space-3` (12px); tabs/add keep `--space-4` (16px) on both axes.

## Fixes and files

1. Design: `ItemTabs.module.css` removes toolbar padding/margins so unnamed tab + add fit a 390px phone; longer names wrap with a 16px gap. `BuyPage.module.css` gives the preview/toolbar/editor explicit parent gaps and hides the empty choice/name wrapper in photo substep 2 (it previously introduced another 32px). Pet/photo/note fields now use 24px. `PhotoTiles.module.css` reduces hint → photo controls to the same 8px internal step. Colour/finish fieldset errors move inside their own fieldsets in `buy/BuyItemsStep.tsx`, avoiding trailing margins and keeping errors associated with their controls. `OptionalNote.module.css` uses block flex for summary, removing inline baseline space below the final closed note.
2. Details/end: `ContactFields.tsx/.module.css` group related rows with parent gaps, keeping subgrid alignment and responsive pairs; `ui/Field.module.css` and city remove the trailing 24px margin. `/buy` suppresses the redundant contact heading through `buy/BuyContactStep.tsx`; QR retains its heading after the ornaments. The existing action margin supplies exactly one 24px gap. The existing negative bottom margin cancels card padding once; no extra dock reservation exists in the current source. `FormPage.tsx/.module.css` group ornament cards separately from the contact section and apply the shared section divider.
3. Review: `ReviewCard.tsx/.module.css` exports shared `ReviewProduct`; both `buy/BuyReviewStep.tsx` and `form/FormReview.tsx` use ornament | details with finish/photos | price, aligned at the top. QR preserves its existing pet name and finish labels. Thumbnails shrink inside narrow middle columns at 320px. Card, terms and supporting-copy gaps belong to their parent grids, with zero trailing margins.
4. Delivery: `buy/BuyDateStep.tsx` separates method/date sections and groups date content; `BuyPage.module.css` uses the same 32px section separation, 16px heading gap and 24px earliest/calendar/selected-date gaps. Calendar edge clearance on phones and pickup controls remain.
5. Footer, contrast surfaces, sticky positioning/safe areas/short-window fallback and `.actions:has(.stripeLine)` payment wrapping were retained.

No customer copy changed except suppressing the duplicate details heading. No backend, payment logic or snapshot image was edited by this task.

## Checks performed

From `frontend/`, all passed after the final code change:

```sh
VITE_DATA_SOURCE=http npm run build
npm run lint
node --test tests/*.test.mjs
```

Build includes TypeScript compilation; existing PostCSS warning remains. Lint reports existing warnings and passes all 30 staff CSS contracts. Node: **50 passed, 0 failed**. `git diff --check` passes.

```sh
npx playwright test e2e/layout.spec.ts e2e/design-system.spec.ts e2e/form.spec.ts --list
```

Discovery passes: 166 cases; this does **not** execute browser tests. `layout.spec.ts` adds one fixed 390×844 phone regression in the mobile project: scroll to the card end, blur focus, wait for fonts and require last postcode/city → sticky bar gap to equal `space-5` within ±2px; it also verifies a normal field gap and the heading removal. `design-system.spec.ts` and `form.spec.ts` assert photos/finish share the middle product column. No test expected the removed heading; review Contact headings remain valid.

## Claude browser handoff

```sh
cd frontend
npx playwright test e2e/layout.spec.ts e2e/design-system.spec.ts e2e/form.spec.ts
npx playwright test e2e/public-mobile.spec.ts
npx playwright test e2e/a11y-visual.spec.ts --project=mobile --project=tablet --project=desktop --update-snapshots
npx playwright test
```

Follow the existing visual policy: remove the affected old baselines before regeneration, inspect each fresh image, then run the full suite. Do not change screenshot tolerance, axe rules or timeouts. In addition, inspect real 390×844 scrolled views for all design substeps (note closed/open), delivery, details, review/terms and QR details/review; include the end of every form and long/multiple-ornament cases. Check 320px review photo wrapping and ≥768px paired fields.

All 12 affected baselines are in `frontend/e2e/a11y-visual.spec.ts-snapshots/`:

| Screen | Mobile | Tablet | Desktop |
|---|---|---|---|
| Design | `design-mobile-darwin.png` | `design-tablet-darwin.png` | `design-desktop-darwin.png` |
| Delivery | `delivery-mobile-darwin.png` | `delivery-tablet-darwin.png` | `delivery-desktop-darwin.png` |
| Details | `details-mobile-darwin.png` | `details-tablet-darwin.png` | `details-desktop-darwin.png` |
| Review | `review-mobile-darwin.png` | `review-tablet-darwin.png` | `review-desktop-darwin.png` |
