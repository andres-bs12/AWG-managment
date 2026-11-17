# Motion & UI polish plan (2026-11-12)

Source: Emil Kowalski's skills (`emilkowalski/skills`), installed project-level in `.claude/skills/`
(web skills only; `write-swift` and `animate-expo` skipped). Lock file: `skills-lock.json`.
Audit stamp: commit `2136014` plus the uncommitted v3.1 working tree. **No source code changed in this pass.**

## How the skills map to this project

| Skill | When to use it here |
| --- | --- |
| `emil-design-eng` | Base bar for any UI/motion change (easing, durations, press feedback, origin). |
| `improve-animations` | Repo-wide audit → self-contained plans (this document follows its format). |
| `review-animations` | Review every motion diff before merge (cross-LLM rule still applies). |
| `find-animation-opportunities` / `remove-animations` | Before adding motion: what earns it, what should go. |
| `choreograph` | Step changes in `/buy`, Thanks page, Home entrance (several parts moving together). |
| `mobile-native` | Sticky hover after tap, tap highlight, 100vh/safe-area — matches our Safari work. |
| `break-ui` | Worst-case data on review/receipt/Track (long names, 6-letter backs, many Kugeln). |
| `prototype` | Compare variants side by side (e.g. the primary-button colour). |
| `pick-ui-library` | Only when a real need appears (see "Libraries" below). |
| `animation-performance`, `apple-design`, `gestures`, `animation-vocabulary`, `ask-sonner` | Reference when the matching task comes up. |

Not covered by these skills: e-mail templates (none in the repo), shadcn/Magic UI/Aceternity components.

## What is already right (keep)

- Tokens exist: `--dur-press/-change/-enter/-exit`, `--ease-enter` (strong ease-out), `--ease-press`, `--motion-press-scale: 0.97`, reduced-motion overrides (`styles/tokens.css`).
- No `transition: all`, no `ease-in`, no `scale(0)`, no animated layout properties in `src/`.
- Every animated component handles `prefers-reduced-motion`; scene motion is `transform`/`opacity` with `steps()`.
- Preview flip (`OrnamentPreview.module.css:24`, 450 ms ease-in-out) is an on-screen morph shown rarely: correct curve, keep.

## Findings (vetted, ordered by leverage)

| # | Sev | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- | --- |
| 1 | MED | Cohesion / feedback | `components/ui/Button.module.css:13-34` | Press is `translateY(1px)` at `0.12s ease`; the `--motion-press-scale`/`--ease-press` tokens are unused here, while `BuyPage.module.css:801-802` re-implements `scale(.97)` locally. Two press languages. | One press for all public buttons: `transform: scale(var(--motion-press-scale))`, `transition: transform var(--dur-press) var(--ease-press)`; delete the local `.shop button` rule. Staff keeps its own skin. |
| 2 | MED | Mobile (sticky hover) | `Button.module.css:26,55` (`.btn:hover`, `.primary:hover`) | Hover colours are not gated: on iPhone the tapped green button stays `--green-deep` after the tap. | Wrap hover rules in `@media (hover: hover) and (pointer: fine)`; keep `:active` ungated. |
| 3 | MED | Easing / duration | `components/public/TrackDialog.module.css:36,206-214` | Dialog enters with 340 ms `--pop-ease` (overshoot 1.56) via keyframes: bouncy on a functional dialog and over the 300 ms budget. No exit animation (it vanishes). | Enter 240 ms `--ease-enter`, from `translateY(8px) scale(0.96)` + `opacity: 0` (centered origin is correct for modals); exit 150 ms opacity + `scale(0.98)`. |
| 4 | LOW | Duration | `pages/public/BuyPage.module.css:818-819` | "Changed" highlight in review runs 450 ms. | 250 ms `--ease-enter`. |
| 5 | LOW | Cohesion | `styles/tokens.css` | `--scene-ease` and `--pop-ease` overlap `--ease-enter`; `--cta`/`--cta-press` are unused; `src/App.css` is not imported anywhere (Vite leftover). | Document `--pop-ease` as scene-only; remove dead `--cta*` and `App.css` after confirming with `grep`. |

## Missed opportunities (additive, need owner's OK)

1. **Price total** (`pages/public/buy/CartRows.tsx:13`): toggling "Name ja/nein" or delivery fee swaps the number instantly. A digit roll (NumberFlow) explains the change. Seen occasionally → allowed.
2. **Step change in `/buy`** (design → delivery → review): content teleports. A 200 ms shared fade + 8 px shift (direction follows forward/back) gives spatial sense. Use `choreograph`.
3. **Thanks page** is the one rare, emotional moment: a single short choreographed entrance (Kugeln then code then actions, 40-60 ms stagger) is within budget. Nothing looping.
4. **Countdown seconds** on Home: deliberately left static. It ticks every second; rolling digits there would be constant motion. Reject unless the owner wants it.

## The primary green (`--green` #1f7a4d)

- Contrast is fine: white on `#1f7a4d` = 5.32:1, on `#14553a` (hover) = 8.79:1.
- Fit: in the Home screenshot (1280×800) the button reads darker and duller than the scene's greens (trees, bunting `--green-bright`), next to saturated sky blue, berry red and gold. It works but looks like a different palette.
- Proposal: build 3 variants with the `prototype` skill and let the owner pick on a real phone:
  A. current `#1f7a4d`;
  B. a brighter green taken from the scene's trees, keeping ≥ 4.5:1 with white;
  C. berry red (`--berry-deep` #b53229) as a Christmas CTA, green kept for "paid" states.
  Do not change the token before that choice.

## Libraries (from the owner's list)

| Library | Verdict |
| --- | --- |
| NumberFlow | **Yes, candidate** for the price total (finding/opportunity 1). Small, no Tailwind. |
| Sonner | Not now: the only toast-like message ("Kugel 2 entfernt · Rückgängig") is inline and accessible; a toast would move it away from the item. Revisit for staff save/confirm messages. |
| Base UI / Radix | Only if we rebuild dialogs/popovers (HelpTip, TrackDialog); gains focus handling and `--transform-origin`. Not a polish task. |
| Vaul | No: no bottom sheets in the public flow. |
| cmdk | No: no command palette. |
| shadcn/ui, Magic UI, Aceternity, 21st.dev, RareUI, Beautiful UI | **No.** Tailwind-based, a different visual language; they would create the "mix of things" the owner wants to avoid. Use them only as visual reference. |

## Suggested order (after v3.1 is committed)

1. Findings 1 + 2 (one plan: shared `Button` press/hover) — `review-animations` on the diff, Playwright screenshots regenerated and reviewed by eye.
2. Finding 3 (TrackDialog enter/exit).
3. Green prototype → owner decision.
4. Opportunities 1–3, one at a time, each with a feel check (DevTools 10 % speed, reduced motion on, real iPhone).
5. Findings 4–5 cleanup.

Each step: implementation by one model, review by a different one (`docs/agent-routing.md`).
