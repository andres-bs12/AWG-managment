# Resolve release/v1.1 into feat/backend-domain (2026-11-12)

Status: **partial — worktree resolved and checks pass; staging blocked by sandbox**. The original 56 conflicted paths contain resolved content (PNG files match HEAD). Git still reports unmerged index entries because `.git` is read-only in this session. No commit, abort, push or deployment was run. Pre-existing local `docs/agent-routing.md` content was preserved.

## Migration compatibility

- Production `V8__item_handover.sql`, `V9__soft_cancel_orders.sql`, `V10__pending_checkout_client.sql`, `V11__painting_hours.sql`: byte-for-byte equal to `release/v1.1`.
- Ours `V8__invoices.sql` moved on disk to `V12__invoices.sql` without any SQL/content change. `git mv` failed because index writes are blocked; staging the deletion/addition will record the exact rename.
- Ours added no other migrations after f494caa. Versions are unique V1–V12; invoice/invoice_counter and its index do not conflict with V8–V11. PostgreSQL/Flyway execution was not performed (backend tests use H2).

## Functional integration

- Retained v1.1 painting-day caps/hours, sales/search, staff mobile overhaul, item selection/batch handover and undo, retained/read-only soft cancellations, stock/time release and retention cleanup.
- Retained checkout cap of two pending orders by client-IP hash from `request.getRemoteAddr()` and email, 15-minute expiry, Stripe reconciliation; HTTP/mock contracts include new fields and localized `PENDING_CHECKOUT_LIMIT` recovery.
- Ported uppercase-expanded paid-name validation and server name-error focus onto the existing back-name control; Back cancels direct return to review and server errors survive blur until edited.
- Ported Track cancellation status and hiding of obsolete fulfilment/address controls; QR post-save focus, no wipe, and replace navigation.
- Preserved ours invoices/payment receipts, optional petName, delivery windows/confirmationEmail, three-screen shop, one-page ornament editor, tile picker, Safari and pixel fixes.
- Fixed cancellation JSON Content-Type and staff missing-name warnings (unnamed ornaments are valid; missing paid back lettering is still checked).
- Removed auto-merged older pet-name reconciliation in buyDraft and DesignGuide; kept obsolete persisted buyStep cleanup. Both dictionaries contain all keys from both branches, and every current literal translation call resolves in both languages.
- Existing public E2E/helpers/PNG files use ours; incoming staff feature specs retained. Incoming QR and eleven-viewport public-mobile checks adapted to current public UX. Removed incoming details snapshots for the removed separate contact screen.
- `deploy/deploy.sh` and `deploy/status.sh` retain incoming sudo-compose behavior.

## Validation

- Requested `./mvnw -q test`: compiled, but Mockito/Byte Buddy self-attach was blocked by sandbox.
- Full backend rerun passed: **131 tests, 0 failures/errors/skips**, with `./mvnw -q -DargLine=-javaagent:/Users/andresbejarano/.m2/repository/net/bytebuddy/byte-buddy-agent/1.18.11/byte-buddy-agent-1.18.11.jar test`.
- `npx tsc -b --noEmit`: passed.
- `npm run lint`: passed with existing/branch warnings; 30 staff CSS contracts passed.
- `node --test tests/*.test.mjs`: 61 tests passed (includes locale parity/usage and checkout-limit localization regressions).
- Changed/new E2E files pass TypeScript syntax checks; Playwright `--list` collected 184 cases across public-mobile, QR receipt and validation specs (collection only, no browser run). Incoming name-field rejection cases were adapted to the existing paid-name field.
- Added invoice regression: partial item handover issues the final invoice snapshot only on last-item handover.
- No Playwright/browser, fresh visual screenshots, real iPhone, live Stripe or PostgreSQL migration verification performed.

## Each original conflicted path

| Path | Resolution |
|---|---|
| `AGENTS.md` | Combined current public decisions with v1.1 staff/backend facts; branch is feat/backend-domain, applied V8–V11 remain immutable, invoices use V12; obsolete public checkpoints labelled historical. |
| `awg-tracking/src/main/java/com/artwithgab/awg_tracking/config/AwgProperties.java` | Full property union: invoice configuration, checkoutMinutes, delivery windows and validation; ours already contained the required union. Service keeps v1.1 fixed 15-minute reservation. |
| `awg-tracking/src/test/java/com/artwithgab/awg_tracking/StripeSignatureTests.java` | Full union Shop constructor including checkoutMinutes and delivery window; both sides signature tests retained and compile. |
| `docs/design-system.md` | Current three-screen, single-page ornament editor takes precedence; retained v1.1 staff/spacing facts and removed active obsolete public substep guidance. |
| `docs/frontend-api-swap.md` | Combined API contracts: sales, painting hours, per-item handover, cancellation, pending caps/expiry, invoices/receipts and delivery window. |
| `frontend/e2e/a11y-visual.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/delivery-desktop-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/delivery-mobile-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/delivery-tablet-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/design-desktop-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/design-mobile-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/design-tablet-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/review-desktop-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/review-mobile-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/a11y-visual.spec.ts-snapshots/review-tablet-darwin.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/design-system.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/fixtures/pet.png` | Ours bytes exactly (including fixture); no snapshots regenerated. |
| `frontend/e2e/form.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/helpers.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/journey-deep.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/journey.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/keyboard-availability.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/layout.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/persistence.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/pickup.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/e2e/success.spec.ts` | Ours current public-flow spec/helper retained; no mobile substeps or obsolete pet-name input restored. |
| `frontend/src/components/public/ContactFields.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/components/public/ContactFields.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/components/public/OptionalNote.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/components/public/OrnamentPreview.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/components/public/PhotoTiles.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/components/public/PublicForm.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/components/public/PublicForm.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/components/public/usePublicActions.ts` | Retained ours file, rejecting incoming deletion as requested; current CSS sticky public implementation retained. |
| `frontend/src/components/ui/Field.module.css` | Ours public-shell scope, input sizing and invalid styles; existing staff defaults retained. |
| `frontend/src/components/ui/HelpTip.tsx` | Ours public question glyph and original staff glyph/disclosure semantics retained. |
| `frontend/src/i18n/LocaleContext.tsx` | Ours copy/structure/default German retained; added every key absent from theirs in both en/de, plus localized cancelled-order status/body. Literal t() calls and locale key parity verified. |
| `frontend/src/layouts/PublicLayout.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/layouts/PublicLayout.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/lib/publicFormFocus.ts` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/BuyPage.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/BuyPage.tsx` | Ours editor/layout retained; ported paid-name validation, name-error focus, persistent server errors and Back cancelling direct review return. |
| `frontend/src/pages/public/FormPage.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/FormPage.tsx` | Ours optional-name/tile editor retained; ported paid-name validation, name-error focus and replace navigation after save. |
| `frontend/src/pages/public/HomePage.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/TrackPage.module.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/TrackPage.tsx` | Ours layout/focus recovery retained; ported cancelled state, hid progress/artwork/delivery/address actions for cancelled orders; QR save banner receives focus and skips wipe. |
| `frontend/src/pages/public/buy/BuyContactStep.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/buy/BuyDateStep.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/buy/BuyItemsStep.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/buy/BuyPetStep.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/buy/BuyReviewStep.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/form/FormItems.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/pages/public/form/FormReview.tsx` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `frontend/src/styles/tokens.css` | Ours newest public UI/focus/tokens retained as base, preserving one-page editor, tile picker, optional name and Safari/pixel fixes. |
| `tasks/todo.md` | Combined current backlog and staff follow-ups; obsolete public checkpoints historical; production V8–V11 acknowledged, invoice validation is V12. |

## Additional integration edits outside the original conflicts

- `awg-tracking/src/test/java/com/artwithgab/awg_tracking/InvoiceApiTests.java`: new handover signature and partial-handover invoice regression.
- `frontend/src/lib/buyDraft.ts`, `frontend/tests/buy-draft.test.mjs`: preserve optional/stored names, discard obsolete persisted screen.
- `frontend/src/api/http/services.ts`: cancellation JSON header.
- `frontend/src/components/staff/CompleteOrderDialog.tsx`, `frontend/src/components/staff/useItemStatus.tsx`: optional names remain valid.
- `frontend/src/pages/dev/DesignGuide.tsx`, `frontend/src/styles/global.css`: ours public behavior/Safari scope retained; incoming staff canvas retained.
- `frontend/e2e/public-mobile.spec.ts`, `frontend/e2e/qr-received.spec.ts`, `frontend/e2e/validation.spec.ts`: adapted incoming functional checks to current public UI.
- `frontend/tests/locale-contract.test.mjs`: dictionary parity, literal translation coverage and checkout-cap localization.
- `docs/agent-routing.md`: pre-existing local row preserved; delegation results appended.

## Remaining index step

Run from this repository in a session that can write `.git`:

```sh
git add -A
git diff --name-only --diff-filter=U
git diff --cached --check
git status --short
```

The unmerged-path command should print nothing. Review staged changes, including the invoice rename. Do not commit, abort or push as part of this task.
