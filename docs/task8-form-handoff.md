# Task 8 — QR customer form

Implementation complete; browser validation pending. No commits. No Playwright commands were executed, including discovery or snapshot updates.

## Implemented scope

1. `/form/:token` and `/buy` share `PublicPage` / `PageHeader`, `Field`, `ProgressSteps`, `PhotoTiles`, `ContactFields`, `OptionalNote`, `InsetNote` and `StickyActions`. Both use `ReviewCard`, `OrnamentPreview` and `HelpTip`. `PublicState` handles QR expiry/invalid/locked/retry and shop configuration errors. `OrderTimeline` is shared with `/buy/thanks`. No purchase-choice controls appear in the QR form: colour, finish and the bought name option are fixed facts, so ChoiceList is not appropriate here. Front/Back uses the existing public SegmentedControl.
2. Every ornament has an illustrated preview: editable custom items use live previews; mixed-order finished items and review use static previews. Grey/white are explicit legacy colours. Unknown colour/finish are labelled as unrecorded; unknown order colours are neutral, never silently beige. Reference photos remain separate tiles. Typed back-name case is preserved; the existing globe/script treatment remains. No new character restriction was added to the QR backend contract.
3. Two screens: ornament details + contact/address, then review/send. Exact-field edit links reopen notes as needed. Validation has associated inline messages, a linked summary and focus on the first failed control. Native form submit, upload/send guards, heading focus and sticky clearance are implemented. Text drafts remain token-scoped in sessionStorage; local photo bytes are excluded and require re-entry after reload. Server-photo identifiers resolve only against the latest form view. Locale changes preserve unsaved photos and texts.
4. Completion says “Angaben gespeichert / Details saved”, has the saved/painting/handoff timeline, order code, clipboard feedback and Track link. It does not claim payment or email delivery. Expired, invalid, locked and transient load errors are distinct, including expiry/lock returned during submit.
5. New DE/EN copy is in `LocaleContext.tsx`. Existing legal text and backend/API contracts are unchanged. The mock already implements the form contract and real 30-day expiry; it is reused unchanged. Stock seed revision 12 remains unchanged.
6. `e2e/form.spec.ts` contains 11 cases, included in mobile (360), tablet (768), desktop (1280) and reduced-motion projects: DE/EN mock happy paths with saved-data checks and axe on details/review/success; DE/EN validation; reload; real mock expiry plus invalid/locked links; Vienna address/postcode and saved server photos; keyboard-only completion with focus/occlusion checks; partial upload failure/limit; two independent ornaments; real HTTP adapter field rejection and submit-time expiry. No accessibility assertions were removed or weakened. Existing photo-button selectors now include the count in `journey-deep.spec.ts` and `keyboard-availability.spec.ts`.

## Local verification

- `npm run build`: passes. Existing PostCSS `from` warning remains.
- `npm run lint`: passes with existing warnings; no new warning in Task 8 components.
- `node --test tests/*.test.mjs`: 15 pass, including three draft recovery/identity/privacy tests.
- Static TypeScript check on the three changed E2E specs: only the existing Playwright/axe `Page` mismatch in `e2e/helpers.ts:45`. No dependency changes.
- `git diff --check`: passes.

Build/lint and source checks are not proof of rendered accessibility or successful browser journeys.

## Claude verification

From `frontend/`, run `npx playwright test` normally. The previous 149-case result predates these changes; the new form suite adds 44 executions across four projects (expected total 193). Do not infer that the old count/results describe the current app.

- Run `form.spec.ts` at all configured widths and reduced motion, both languages. Also inspect 360×640, 320px/reflow and 200% text zoom. Confirm all custom items and mixed finished items, colour/finish/legacy labels, exact-field editing and re-entry of photos.
- Check keyboard focus and rings after native picker, Tab/Shift+Tab, failed Continue, server field errors and changing locale. No horizontal page scroll; sticky actions must not cover focused fields. Confirm the common address grid preserves owner-approved pairings from 768px.
- Repeat the existing `/buy`, thanks, layout, keyboard, guide and axe suites because their shared primitives changed. Confirm source-confirmed payment polling, checkout payload and history remain intact.
- Keep all nine existing reference PNGs. Shared page geometry/progress/photo controls intentionally changed, so old screenshots may differ. Inspect actual/diff images before any owner-reviewed reference update; never delete or automatically accept snapshots to silence differences.
- Remaining manual/transport checks: backend multipart round trip, live token expiry, SMTP delivery (if configured), Stripe real integration and screen-reader/virtual-keyboard behaviour are not validated by these mock/intercepted tests.

No audit rows are closed based on source work alone; see the Task 8 source follow-up in `design-system-audit.md`.
