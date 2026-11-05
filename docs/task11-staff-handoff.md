# Task 11 — staff implementation handoff

Date: 2026-11-05. Branch: `feat/backend-domain`. Started from a clean working tree. No commits, Playwright runs, screenshot deletions or snapshot acceptance. Owner-approved public changes and mock seed revision 12 (three of every colour/finish) are preserved.

**Implementation is done for the requested frontend P0/P1 work. Browser verification and independent Claude review are not done.** Local source checks are not a claim that axe, touch or visual layouts have passed in a browser.

## Corrections by report ID

- **P0-1 — done:** HTTP demo time is null; `useStaffClock` formats the live Europe/Vienna date/hour and ticks every minute/focus. Mock keeps its demo hour. Agenda reservations, moves and current-time line share this clock. Unit tests cover winter, summer, midnight and DST; the written HTTP E2E uses a Honolulu device timezone and a morning sale.
- **P0-2 — done:** Save move explicitly reloads. Successful authenticated HTTP mutations emit invalidation; staff readers refresh on mutation, focus, visibility and a visible minute interval, independently of mock subscriptions.
- **P0-3 / P1-8 — done:** every fresh/empty/calendar draft receives a new idempotency key, persisted with that draft and reused for retries. One-shot `fresh` and calendar creation parameters are removed with router replacement. Back links strip `fresh`. Tests cover two finished sales and two custom QR sales, including a reload and a payment on the second order.
- **P1-1/2/3 — done:** only 401 clears a boot token; offline retry preserves it. Logout clears local access and drafts immediately, with best-effort server revocation. HTTP 401 uses an auth event and router `next`/expired state, preserving draft and query without reloading. Cross-tab token removal locks out staff. Sliding server sessions from Claude are preserved.
- **P1-4 — done:** CustomerHandoff confirms that staff will sign out, clears access before opening the public form, and replaces the current route. Back into a staff route requires sign in. The QR form's existing Track completion remains intact. A new tab alone was avoided because tabs share localStorage.
- **P1-5 — done:** header search and `/staff/search?q=…` call the encoded HTTP search contract. Results show code, customer, phone, payment, handoff and total, with router navigation back to the list.
- **P1-6/7 — done:** attention badge/list call `/api/orders/attention`; PENDING and REVIEW reservations render hatched with no customer data. Only a genuine pending expiry is displayed; REVIEW has no expiry promise. Holds remain in overlap geometry and cannot be moved or opened as customer slots.
- **P1-9 — done:** sale colour/finish radios show stock, last-one and sold-out states; finished stock is visible. Combined demand is checked before planning. Stock tests explicitly use `api.inventory.update`, rather than relying on the seed.
- **P1-10/11 — done:** payment state precedes method and deposit amount. Amount appears only for Deposit, and the custom-order payment action uses the actual amount. Finished Done has a visible missing-method reason and validates deposit before creating an order. Immediate finished handover with a balance also requires confirmation.
- **P1-12 — done:** all three sale prices come from server config, including the added finishedPrice. Missing prices block creation with recovery, rather than using defaults. Mock prices live in its API config; the shared calculator requires prices explicitly.
- **P1-13 — done:** candidate dates and move-suggestion requests run with Promise.all. Ornaments allocate in handoff order so a later ornament receives earlier allocations as extraBusy; dependent allocations deliberately remain ordered. No new server planner endpoint was needed for the requested parallelisation.
- **P1-15 — done:** corrections live behind Correct payment, have an explicit corrected state/amount and confirmation, with one error announcement. Pending Checkout has no manual collection controls.
- **P1-16 — done:** delivery rows/cards show Collect + remaining. Shared handover re-reads the bundle, checks every ornament and warns if a balance remains. It offers collection method + Mark paid & hand over, explicit handover with debt, or cancellation. Payment and handover remain two absolute API operations; if only handover fails, retry does not duplicate a receipt.
- **P1-19 — done:** handed-over cancellation is disabled with a reason. The dialog names permanent deletion, photos/form/payment record, actual money received, painted items and manual refund obligations. Painted blanks are not restocked (Claude's rule, mock synced).
- **P1-20 — done:** order and Paint share useItemStatus: missing-data confirmation, last-item native Complete order dialog and explicit warning before a status change undoes an existing handover.
- **P1-21 — done:** HTTP errors preserve the specific English server message. Public pages retain their code-based locale mapping. Sale helpers no longer replace precise server messages with generic text.
- **P1-24 — done:** market/day deletion has native confirmation. Day removal and edited hours stay local until one Save request. Delete market remains an explicit immediate destructive operation after confirmation. Failed deletion surfaces the server error.
- **P1-25 — done:** bottom Agenda / Deliveries / New sale / Search / More tabs at portrait/tablet widths. More is a native modal with Stock, Markets, Painting days, Password and Log out. Desktop retains direct navigation.
- **P1-23 — already done by Claude; mock done here:** new stall dates with Vienna deliveries reject with DAY_HAS_DELIVERIES, field days.

**Owner-only items, not done by instruction:** P1-14 editing after sale; P1-17 per-item handover; P1-18 soft cancellation/accounting retention; P1-22 capacity policy. See `tasks/preguntas-pendientes.md`. Grouping equivalent delivery rows does not change the order-level handover model. The original hard-delete model remains, with an honest confirmation.

## P2 scope

- **Done:** P2-1 short touch no longer creates a proposal outside explicit editing (hold/drag or Add paint session); P2-2 all overlaps shown in lanes with a warning; P2-3 fractional opening-time offsets; P2-4 booked/max warning; P2-5 minute/focus refresh; P2-6 no past pickup hours; P2-7 Vienna choices require a painting date before handoff; P2-8 adding a name switches the normal 60-minute preset to 75 while custom duration stays intact; P2-9 booked/max replaces misleading free-hour labels; P2-10 prefer today's stall over home.
- **Done:** P2-11 finish and customer fallback in Paint; P2-12 market-day read errors handled; P2-13 stock conflict keeps typed input and offers Use mine / Keep server count; P2-14 settings page/stepper design; P2-15 server isToday with Vienna-clock fallback; P2-16 Austrian comma/grouped costs; P2-17 apply first day's hours to all; P2-18 router agenda link; P2-19 upcoming by default, optional past days, inline market handover and month in chips; P2-20 password wrapper/back, distinct password and 72 UTF-8 byte validation.
- **Partial P2-21:** source, Vienna created time and recorded payment method are displayed. The API does not supply Stripe reference or actual receipt history, so neither is invented.
- **Done:** P2-22 pending payment controls; P2-23 unconfirmed production blocked in the UI and handover undo confirmation; P2-25 obsolete staff navigation CSS replaced; P2-26 long order/item/address headings clamp with full title/accessibility text; P2-27 deposit documentation and backend test count corrected.
- **Not done P2-24:** per-account authentication back-off is a separate backend/security change; existing IP rate limit remains. It was marked acceptable for now in the review.

## Design-system layer

The new Staff section in `docs/design-system.md` is normative. All 26 staff/shared CSS modules pass the token checker. IBM Plex, staff type/density roles, 44px minimum targets, tabular money/time, C1 native radio choices, shared Field/Button/ChoiceList/HelpTip/InsetNote, native modal focus handling, tablet navigation, safe-area clearance and sale actions in a separate reserved shell row below the scrollport are implemented. Staff selectors use `[data-staff-page]`, including sign in and modal content. Public button styling is preserved in its existing branch. No colour/layout/filter transitions were introduced; reduced-motion CSS disables transform/opacity animation.

`.stylelintrc.json` contains the raw-hex/pixel bans. **Stylelint binary installation is not done:** registry DNS failed (`ENOTFOUND registry.npmjs.org`). To enforce the contract immediately, `npm run lint` also runs `scripts/lint-staff-styles.mjs` with the installed PostCSS parser, checking colours, dimensions, type/duration literals, invalid declarations, motion properties and unknown tokens. PostCSS is declared as a direct development dependency at the already-installed/locked version; no package download was needed. Install/run Stylelint when networking is available.

## API and deployment

Additive backend DTOs supply finishedPrice; order checkoutStatus/source; AgendaSlot held/holdUntil; delivery remaining/paymentState. Held order/item/customer fields are null. No entity or migration changed. The new staff frontend requires the matching backend config, so deploy backend first. Search/attention, painted-base cancellation, DAY_HAS_DELIVERIES and sliding-session changes supplied by Claude are preserved. Mock implements the same visible contract and keeps revision 12.

## Verified locally

- `cd frontend && npm run build` — pass.
- `cd frontend && npm run lint` — pass, with React/Fast Refresh warnings; token check passes 26 modules. Stylelint itself did not run.
- `cd frontend && node --test tests/*.test.mjs` — 23 pass, none failed/skipped.
- `cd awg-tracking && ./mvnw -o -q test -DargLine=-javaagent:/Users/andresbejarano/.m2/repository/net/bytebuddy/byte-buddy-agent/1.18.11/byte-buddy-agent-1.18.11.jar` — 92 pass, no failures/errors/skips. The existing shop assertion that finishedPrice is absent was updated for the intentional staff config addition; custom-only shop eligibility remains tested.
- Staff E2E/config static lint — pass. A broader static check of all E2E files also reports existing unknown/spread typing at `pickup.spec.ts:16`, which was not changed in this task. Targeted TypeScript check reports the existing Playwright/axe Page incompatibility at `e2e/helpers.ts:45`; no cast, dependency change or accessibility weakening was used to hide it.
- `git diff --check` — pass. No commits.

## Claude's external validation

Run `cd frontend && npx playwright test e2e/staff-review.spec.ts --project=ipadPortrait --project=ipadLandscape --project=desktop` outside the sandbox. There are **34 written cases, 102 intended executions**, including 14 page-level axe cases and a scoped 390px reflow/axe journey. Fixtures select the real HTTP adapter/demo entry and intercept only backend responses, so constant mock subscriptions cannot mask missing HTTP refetches. Stock starts at three; sold-out states are prepared through the inventory API. Changed server prices catch hard-coded totals.

Verify live-clock ticks, morning creation, mutation/focus refresh, two-sale identity and reload, custom QR/payment, offline boot/logout/401 restoration, kiosk/back access, search/attention/holds, payment correction, balance collection, cancellation, shared completion, market/day staging and native radio keys. Inspect screenshots at 820×1180, 1180×820, 390px and desktop, with keyboard/touch, short visual viewport, long names and reduced motion. Check real HTTP integration and physical iPad Safari as well as the intercepted flows. Keep axe at zero for every page; inspect all differences before accepting visual references. Run existing public suites as regression coverage for the shared controls. No new baselines have been accepted here.
