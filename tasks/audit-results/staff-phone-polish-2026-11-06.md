# Staff phone polish — 2026-11-06

Implementation complete locally; **partial until Claude runs the browser assertions and reviews fresh screenshots**. No commit. All incoming local/staged changes retained; no backend changes in this task. The owner reports **681 passed** before this pass; no new E2E green result is claimed. Current collection is **693 tests in 19 files**, including 48 staff-mobile cases (10 new cases across the two staff phone projects). Collection does not execute a browser.

## Five defects

1. **Bottom navigation:** `frontend/src/layouts/StaffLayout.{tsx,module.css}`. Five equal columns, real inner padding with specificity above shared button states, compact Deliver/Sale labels with full accessible Deliveries/New sale names. Existing 14px staff metadata token and minimum 44px targets preserved. Large actions retain 56px; Not yet dialog actions remain.
2. **Filters and first results:** new `components/staff/StaffFilters.{tsx,module.css}`, `pages/staff/DeliveriesPage.{tsx,module.css}`, `pages/staff/SalesPage.{tsx,module.css}`, `components/staff/DeliveryOrderCard.module.css`. Below 768px, Filters (count) discloses mounted controls; delivery day/search remain inline. Count includes non-default day, production, handoff and include-past on Deliveries; payment/source/created period on Sales (search stays inline). No filter calculation or URL semantics changed. Sales uses the same labelled search with a compact visible placeholder. Tablet/desktop retain expanded controls. Phone cart spacing uses existing tokens to keep an initial single-item cart above the fold.
3. **New sale:** `pages/staff/NewSalePage.tsx` removes the initial What are we selling? heading; New sale and the Items step remain.
4. **Inventory and canvas:** `pages/staff/InventoryPage.tsx`, `pages/staff/SettingsRows.module.css`, `styles/global.css`. One article per colour, swatch-only accessible heading, Shiny/Matte groups with independent steppers, save/conflict/low-stock states. Finished stock has its own card. Legacy colours remain separate. Staff html/body match the shell background through scrolling.
5. **Separators:** new `components/staff/StaffText.{tsx,module.css}` keeps each separator with the preceding word, preserving the literal text and allowing time on the next line without a leading separator. Applied to order summary and item handoff/paint rows, Deliveries carts, Agenda pickup cards, Search/attention, Sales metadata and the sweep below.

## Additional sweep findings fixed

- Agenda calendar range/code metadata and over-capacity warning could split at separators (`AgendaPage.tsx`); session status arrows could detach (`AgendaSessionList.module.css`).
- New sale item price and selected paint-slot metadata, plus its summary dates, could split (`NewSalePage.tsx`, `OrderSummaryPanel.tsx`).
- Market cost/season/day rows and market editor summary (`MarketsPage.tsx`, `MarketEditorPage.tsx`), painting-day closed/over-limit text (`PaintingDaysPage.tsx`) and painting order/customer metadata (`PaintPage.tsx`) had the same separator pattern.
- Reviewed all nine supplied staff screenshots (Agenda, Deliveries, Sales, New sale, Search, Attention, Inventory, Markets, Order) and swept staff source for shared patterns. Fresh rendered checks, including the remaining staff routes, belong to Claude's browser pass.

## Verification

- `cd frontend && VITE_DATA_SOURCE=http npm run build && npm run lint && node --test tests/*.test.mjs`: passed. Existing PostCSS build warning and React lint warnings remain; **30 staff CSS modules passed; 50/50 Node tests passed**.
- Updated Playwright specs transpile without syntax errors; `npx playwright test --list` collects 693 cases, 48 in staff-mobile. No browser or port was opened.
- `git diff --check`: passed.
- `e2e/staff-mobile.spec.ts` adds actual geometry checks for equal nav columns/inner label clearance at 320/360/390/440px, full initial result cards above the main-scrollport fold at 360×640 on Deliveries and Sales, disclosure/count/URL behavior, independent grouped-stock saves and canvas backgrounds, and separator line geometry. Existing filter interactions explicitly open disclosures.
- `e2e/sales.spec.ts` and `e2e/staff-review.spec.ts` follow disclosures and accessible stock groups. No assertions, axe rules, screenshot tolerance or timeouts were relaxed.

## Claude handoff

```bash
cd frontend
npx playwright test e2e/staff-mobile.spec.ts
npx playwright test e2e/sales.spec.ts e2e/staff-review.spec.ts
npx playwright test
```

Review staff captures at 360×640 and 360×740, navigation at 320–440px, then tablet/desktop expanded filters and stock. Check first-card geometry before scrolling; open and close filters, keyboard focus, saved values and return navigation; stock conflict handling; date/time wrapping. The five new tests explicitly verify these changes but were not executed here.

**Visual artifacts:** no snapshot PNG files were edited or regenerated in this pass. All supplied staff-*.png views change because of the shared bottom nav; Deliveries/Sales filters, New sale heading, Inventory grouping/canvas and Order summary wrapping additionally change. Staff-mobile screenshots are attachments, not baseline assertions. Existing public design/delivery/details/review baseline files are unaffected by this staff-only polish and were preserved. No claim is made about a fresh Safari result.
