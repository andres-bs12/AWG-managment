# Public QR form, Track and Home fixes — 2026-11-12

Implementation is complete. Browser/viewport verification is pending; Playwright was not run as requested. Existing uncommitted work was retained. No staff components or staff CSS rules were changed in this batch.

Paths below are relative to `frontend/`, except the design-system document.

1. `src/components/public/OrderReceipt.tsx` — anonymous custom items retain neutral ornament numbers unless an explicitly absent name is known.
2. `src/pages/public/FormPage.tsx`, `src/pages/public/FormPage.module.css` — review primary precedes Back in the DOM; full-width stacked buttons below 768px, both lg; Back orders left from 768px.
3. `src/api/mock/seed.ts` — seeded custom items have red/shiny attributes; revision 13 refreshes persisted mock data. No E2E assertions for “Nicht erfasst” or “Not recorded” were found.
4. `src/components/public/PublicForm.module.css`, `src/components/ui/Field.module.css` — grid forms own the 24px action gap; public fields have no trailing margin.
5. `src/pages/public/FormPage.tsx`, `src/i18n/LocaleContext.tsx` — plural page and document titles for multiple ornaments, DE/EN.
6. `src/pages/public/form/FormReview.tsx`, `src/i18n/LocaleContext.tsx` — generic product row, statement label for the back name and “Deine Kugel · Luna” single-item title.
7. `src/pages/public/FormPage.tsx`, `src/pages/public/FormPage.module.css` — 8px heading/intro group and 24px to the following content; summary follows the intro.
8. `src/pages/public/FormPage.tsx`, `src/pages/public/FormPage.module.css` — ornament/contact grouping uses 32px, divider and 24px, matching the existing contact/address separation without adding a second parent gap.
9. `src/pages/public/FormPage.tsx`, `src/components/public/PublicForm.tsx`, `src/components/public/PublicForm.module.css` — only error messages; ornament suffixes only for multiple items; balanced summary title.
10. `src/i18n/LocaleContext.tsx` — no fixed Luna example in the back-name hint.
11. `src/components/public/OrnamentOverview.tsx`, `src/pages/public/BuyPage.tsx`, `src/pages/public/buy/BuyReviewStep.tsx`, `src/pages/public/form/FormReview.tsx` — en dash between numbered ornament labels and names, including removal feedback. The specifically requested single-form title retains its middle dot. Updated expectations in `e2e/design-system.spec.ts`, `e2e/multi-ornament.spec.ts`, `e2e/form.spec.ts` and `e2e/journey-deep.spec.ts`.
12. `src/components/public/OrnamentOverview.tsx`, `e2e/form.spec.ts` — jump-only tiles have neither current nor selected state; regression assertion added.
13. `src/components/ui/Button.module.css`, `src/pages/public/TrackPage.tsx`, `src/pages/public/TrackPage.module.css`, `src/components/public/TrackDialog.tsx` — public-shell button scope covers Home and Track; removed the Track display-font override. The dialog portals into the public shell so it inherits the public controls.
14. `src/pages/public/TrackPage.module.css` — neutral raised facts panel with token border, solid address divider and tokenized colors/spacing; obsolete local timeline/list rules removed (the page uses shared components).
15. `src/pages/public/TrackPage.tsx`, `src/components/public/TrackDialog.module.css` — lookup failure stays on the page with search recovery; empty card is hidden while the dialog is open; garland SVG fits within its top band.
16. `src/pages/public/TrackPage.module.css` — banner and card share width and inline padding at both breakpoints.
17. `src/components/public/OrderReceipt.tsx` — visible back names use `petNameFromBack`, matching painted capitalization.
18. `src/pages/public/HomePage.module.css`, `src/styles/tokens.css` — the old 268/380px reserves predated the wrapping legal footer and its final padding rule. New 500/420px reserves shrink the proportional scene to leave room for the footer at the reported phone sizes. Desktop/landscape rules and the intentional shell `100lvh` remain. Visual verification at 320×568, 360×740 and wider widths is pending.
19. `../docs/design-system.md` — P3 follows the owner's existing order-first Home CTA decision; Home CTA markup was not changed.
20. `src/components/ui/Field.module.css` — 48px border-box public input/select height, including Track/dialog; staff scope untouched.
21. `src/components/ui/Field.module.css`, `src/components/public/PublicForm.module.css`, `src/components/public/PhotoTiles.module.css`, `src/components/public/TrackDialog.module.css`, `src/pages/public/FormPage.module.css`, `src/pages/public/TrackPage.module.css`, `src/pages/public/BuyPage.module.css`, `src/pages/public/BuyThanksPage.module.css`, `src/pages/public/Panel.module.css` — pretty wrapping for public intro/muted copy and hints.
22. `src/components/public/PhotoTiles.module.css` — invalid add tile uses the error boundary token.
23. `src/layouts/PublicLayout.module.css` — mobile footer uses the hint-size token.
24. `src/i18n/LocaleContext.tsx` — “Zur Startseite” / “Back to home”.
25. `src/components/public/TrackDialog.module.css` — title, lead, label and input text align left.

Project context was updated in `AGENTS.md` and `tasks/todo.md`.

Validation: `npx tsc -b --noEmit && npm run lint` passes with existing lint warnings; all 26 staff CSS contracts pass. `node --test tests/*.test.mjs`: 40 passed. `git diff --check` passes. No browser, screenshot, Playwright or real-iPhone validation was performed, and no ports were opened. E2E expectations were edited but not executed. Home sizing and visual geometry remain unverified in a browser.
