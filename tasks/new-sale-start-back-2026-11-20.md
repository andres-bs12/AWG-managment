# New sale: distinct Custom/Finished choices + Back on the left (owner, 2026-11-20)

Owner at the stall iPad: choosing Custom vs Finished happens constantly and the two buttons look the same.
If they pick the wrong one they need an obvious way back to an empty New sale. Today "Start over" is a ghost
button on the right of the header and is hard to find.

File: `frontend/src/pages/staff/NewSalePage.tsx` (+ `NewSalePage.module.css`). Staff UI is English.

## 1. Distinct choices
- The empty-sale start choices (`styles.startChoices`, "+ Add custom ornament" / "+ Add finished product")
  and the add row under the items ("+ Add custom" / "+ Add finished") must be recognisable at a glance:
  - each gets a visual on the left, about 56–64 px: **Custom** = an ornament with a paintbrush or pet face
    (reuse an existing SVG, for example `components/public/PetFaces.tsx` or `PetBauble.tsx`, or a simple
    inline SVG; no new image files); **Finished** = a ready ornament visual, different from Custom
    (for example a plain bauble with a tag/number, or the photo of the first Ready market piece if one is
    already loaded, falling back to the icon);
  - a different accent per kind using existing staff colour tokens (no new hex values); keep text contrast
    WCAG AA;
  - keep the labels and subtitles; targets ≥ 56 px; works at iPad 820×1180, 1180×820 and phone 360×640.
- The same icon appears small (≈24 px) in the add-row buttons so the mapping is consistent.

## 2. Back on the left
- Replace the right-side "Start over" ghost button with a **"‹ Back"** button on the **left** of the
  header, before the "New sale" title, visible whenever `phase !== 'done'` and there are items or an order.
- Behaviour:
  - no order yet and items selected → confirmation `StaffDialog` "Discard this sale?" with text
    "The ornaments you added are removed." and buttons **Discard** (calls `startOver()`) and the dialog's
    normal close (X/Escape/tap outside; no "Not yet" button);
  - an order already exists → the existing `leaveOpen` dialog (unchanged);
  - empty sale → the button is not shown.
- Keep the existing in-step navigation untouched.

## Done when
- `npm run build` (VITE_DATA_SOURCE=http), `npm run lint` and `node --test tests/*.test.mjs` pass.
- Update e2e selectors that use "Start over" (`grep -rn "Start over" frontend/e2e`) to the new Back +
  Discard flow, and add one test in `e2e/market-stock-sales.spec.ts` or a staff spec: add an item, tap Back,
  confirm Discard, the empty start choices are visible again. Do not run Playwright (Claude runs it).
- Short report: files changed and what each does.
