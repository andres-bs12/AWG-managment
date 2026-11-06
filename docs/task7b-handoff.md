# Task 7B — implementation and external validation

2026-11-05. Author/reviewer: Codex, independently reviewing Claude's uncommitted design-system core. No commits. Existing local changes, including the concurrent font dependency, are preserved.

Implementation is complete for items 0–7. Browser outcomes and screenshots remain unverified: the owner explicitly assigns Playwright to Claude outside this sandbox.

| Item | Implementation |
|---|---|
| 0 | Reviewed `git diff HEAD -- frontend docs` against the normative design system. Preserved the measured 48px chips/tabs, 24px swatches, 12px swatch inset/chip/tab gaps, 16px trailing inset, 4px segment padding/gap, desktop 5/12–7/12 layout and 1024px configurator breakpoint. Updated affected selectors and exact geometry checks. |
| 1 | Shared `ReviewCard` label/value/action grids align every fact, including the back name and surcharge. Visible edit actions identify colour, finish, pet details, photos, name, delivery day, address and contact; multi-item accessible names include the item. Edit focuses the exact field/group. Static miniature variant removes hidden radios, repeated disclaimers and motion. One short sentence explains the next step after confirmed payment. Approved legal text is unchanged. |
| 2 | One persistent selected-date status is derived from the same ISO value as cards and calendar. The visible compact date and screen-reader full date are alternatives, not duplicate announcements. No first-date lead or separate box; the first shortcut retains its meaningful earliest label. Date cards and grid use C1. Measured list fallback preserves non-overlapping targets at narrow widths. |
| 3 | Reusable `HelpTip`: city and finish, 44px trigger, topic-specific accessible name, expanded/controls relationships, inline disclosure, outside dismissal, Escape closes from anywhere and restores trigger focus. Vienna constraint copy lives beside the fixed city; delivery timing/postcode help is separate. |
| 4 | Retained Claude's explicit unchosen finish/colour labels; added the actual front/back side to the description. No invented Matte choice. |
| 5 | Sold-out text uses disabled semantic colours (calculated 4.97:1), no opacity reduction; unavailable finishes are labelled even before a colour is chosen. One disclosure reaches the existing `api.shop.joinWaitlist`, with an explicit next-season scope. No per-colour restock notification is invented. API and mock contracts are unchanged. |
| 6 | Lazy `/dev/design` branch exists only in DEV and bypasses auth. Actual public primitives, shop compositions, public components and artwork; token values/contrast, full type and spacing scales, borders/radius/elevation, DE/EN, interaction demos, selected/disabled/error/busy variants, 1/2/max items, 0/1/6 photos, long text, empty/error/sold-out dates/options, local waitlist/dialog actions, motion/zoom controls. Artwork and overlays use isolated frames. No real data, payments, notifications or metrics. Existing legacy component APIs without a particular state are identified as unsupported, rather than represented by invented states. Source and rule links accompany fixtures. |
| 7 | Added the mandatory design-system pointer to `AGENTS.md`; coordinated backlog and this handoff. |

## Bugs found during the independent source review

- Keying a locally stateful preview by active ornament discarded the chosen Front/Back side when returning to it. The shop now owns side state per UID. Enabling the back name intentionally shows the back again.
- Arrow keys activated tabs immediately, contrary to manual activation. `ItemTabs` now moves focus with arrows/Home/End and activates with Enter/Space/click. Every tab controls an existing labelled panel; inactive editors stay hidden. The add button remains outside the tablist, icon-only below 768px; the max-count reason is visible.
- Toolbar scroll clipping could cut the outer focus ring. Its scroll inset now uses the existing 8px space token, retaining the documented tab/control geometry and gaps.
- Side radios had opacity-zero inputs that did not satisfy the existing full-target keyboard checks. The shared public `SegmentedControl` branch retains Claude's dimensions and native radios with transparent, full-target inputs and their own focus rings. Staff appearance is unchanged.
- Pet discs animated `fill`; that transition is removed. The C3 tint values remain unchanged. Task UI no longer sways; the shiny glint uses the 300ms token and the continuing portrait cycle has a pause control. Static review art has no motion.
- CSS hid preview buttons in review, but left the new radio fieldset/inputs behind (the reported stray circle). The explicit static variant renders no selector at all.
- Calendar selection still used older dark-filled/blue recipes. Cards and days now use the same C1 boundary/tint/600 weight, and unselected available days retain ordinary weight. This also makes non-shortcut dates clear through the bound summary.

## Checks run

- `npm run build`: passed (TypeScript and Vite).
- `npm run lint`: passed, with existing warnings; no new guide warning remains.
- `node --test tests/*.test.mjs`: 12 passed. Includes real-token disabled-text contrast and independently known WCAG contrast cases.
- Production bundle inspection: no guide route, component fixture identifiers or injected lookup implementation in generated JS; no DesignGuide chunk emitted.
- `git diff --check`: passed.
- Additional E2E TypeScript check with Node types: only the existing incompatible Playwright/axe `Page` type at `e2e/helpers.ts:45` remains. Dependencies were not changed by Task 7B.
- Playwright: **not run**, per owner instruction. No snapshots updated or accepted.

## Claude's next verification

Run the full suite, especially `design-system.spec.ts`, `journey-deep.spec.ts`, `keyboard-availability.spec.ts`, `layout.spec.ts`, persistence and axe/visual checks. Include 360/768/1280px, 320px reflow, DE/EN, reduced motion, two ornaments and removal, forward/reverse keyboard traversal, off-shortcut date 23 December, help Escape/outside dismissal and direct edit/return. Review changed design/delivery/review screenshots before updating baselines. Do not relax focus, clipping, contrast or geometry assertions.

The new geometry tests compare actual padding/gaps with tokens exactly (no tolerance), require every chip/tab to be 48px, require 44px side segments, and require no selected-swatch box shadow. Review row column starts/ends are also compared exactly. The guide smoke test records API requests and expects none.

The broader public-system migration backlog in `design-system-audit.md` remains authoritative for unrelated components. This task does not claim those legacy styles are migrated, or that source review substitutes for browser evidence.
