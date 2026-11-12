# Staff mobile UX audit — 2026-11-06

Status: implementation complete locally; **partial pending Claude's post-repair browser run**. First full v1.1 run: 639 passed, 40 failed, 2 skipped (681). Failure classifications, subsequent product/test fixes and validation: [E2E repair report](e2e-repair-2026-11-06.md). No commits.

## Audit before implementation

Screenshots 11–14 and the staff source show a task hierarchy problem, rather than a need for more decoration.

| Area | Finding | Required change |
| --- | --- | --- |
| Agenda | Date repeated in subtitle, Day label, select and chips; global Painting days button competes with title. Inline capacity consumes the painting workspace. | Keep chips; day-specific gear at their upper right, editor in a dialog, painting cards first. Keep location only when useful. |
| Painting cards | Slots already come from saved order items, but compact calendar cards omit their order code; list repeats customer/colour/delivery metadata. | Keep time, pet/item, code and production state; preserve order navigation and both views. |
| Deliveries | Filter selections repeated as subtitles and section metadata. Group actions and per-item buttons sit outside their card. Grouping by handed-over state splits one cart after a partial handover. | One complete order card across dates/kinds, with each item's date/time and action inside; retain confirmation/balance behaviour. Filters scope actionable members while preserving cart context. |
| New sale | Chosen slot repeated as “Time available”, duration, paint-to-reserve and summary. Vienna delivery repeats the service schedule and lack of exact time. | Chosen date/slot plus Change; concise handoff summary; keep detailed scheduling errors only when actionable. |
| Order detail | Item handover and production controls lack visual separation; duplicate form/order labels and colour beside swatch. | Separate production and handover groups inside each item; preserve order-level actions and confirmations. |
| Search / Attention | Old results remain visible during a new query or after an error; clearing query can leave old error. | Explicit loading, empty and retry states; verify name/code/phone searches. |
| QR | Sale screen does not fetch the created bundle while waiting. Public submit already awaits the save and redirects, but Track's decorative wipe delays feedback. | Refresh while waiting, show Form received, bypass wipe after confirmed submission; investigate response persistence. |
| Sales | No browseable sales history exists. | Paged authenticated listing with matching mock, payment/source/date filters and existing search. |
| Shell / More | AWG is plain text; More does not include sales. | Home link, clear current navigation, Sales in More. Preserve five bottom tabs. |
| Stock / Painting days | Stock repeats colour beside swatch; day toggles have small label areas; long explanatory text competes with editable limits. | Short help, readable names, generous toggle target and grouped controls. |
| Markets / editor | Metadata packed into one line; defaults repeated in subtitles; mobile save/delete compete. | Clear title/detail rows, quiet destructive group, maintain responsive two-column times. |
| Paint reference | Operational colour is useful without an ornament preview; keep it. Fullscreen controls must remain reachable on short phones. | Preserve workspace; include in phone regression coverage. |
| Public E2E A/B/C | Footer and brand depend on scene behind them; help renders '(?)'; some named-control tests were already corrected locally. | Local opaque contrast surfaces, SVG info button, preserve and finish test migration. |

## Verification boundary

Read `git status` and staged/unstaged diffs first. Existing public-mobile changes and staged Claude hotfix in OrderService/StripeClient are retained. Source audit is not a rendered phone audit. Required follow-up: Playwright at 360×640 and 440×741, fresh visual review and real Safari. No axe rule or screenshot tolerance may be relaxed.
