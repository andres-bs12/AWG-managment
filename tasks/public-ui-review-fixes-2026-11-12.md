# Public UI review fixes — 2026-11-12

Status: implementation finished; browser/visual verification pending. Existing uncommitted work was preserved. No Playwright or browser was run.

Paths below are relative to `frontend/`.

| Finding | Change | Files changed |
| --- | --- | --- |
| 1 | Always-visible 44px tertiary Back row under the Stripe note on phones; secondary Back remains on the left from 768px. | `src/pages/public/BuyPage.module.css` |
| 2 | Explicit Track address-edit grid owns the 24px field spacing, preserving existing public Field and ContactFields spacing. | `src/pages/public/TrackPage.tsx`, `src/pages/public/TrackPage.module.css` |
| 3 | Keep the miss-page opener mounted while the dialog is open; pass its ref to the dialog for explicit focus restoration, including pointer activation. The initial bare `/track` dialog still hides the empty card. | `src/pages/public/TrackPage.tsx`, `src/components/public/TrackDialog.tsx` |
| 4 | Already fixed; PhotoTiles was left untouched. | None |
| 5 | An empty name forces the preview front and removes the parent's pinned side. | `src/components/public/OrnamentPreview.tsx`, `src/pages/public/BuyPage.tsx` |
| 6 | Restore original HelpTip and SegmentedControl staff defaults; scope muted help, glyph, negative margins, wrapping and contents layout to the public shell. | `src/components/ui/HelpTip.module.css`, `src/components/ui/HelpTip.tsx`, `src/components/ui/SegmentedControl.module.css` |
| 7 | Shared colour translations plus explicit grey/white legacy suffix. | `src/components/public/OrderReceipt.tsx` |
| 8 | Constant zero-height editor anchor with an absolute 64px overlay; focus handling measures the overlay and scroll margins use its stable clearance. | `src/pages/public/BuyPage.module.css`, `src/pages/public/BuyPage.tsx`, `src/styles/tokens.css`, `src/components/public/usePublicActions.ts`, `src/lib/publicFormFocus.ts`, `tests/public-focus.test.mjs` |
| 9 | Read the editor-height token once; never use its live height to decide whether to relax sticky positioning. | `src/components/public/usePublicActions.ts`, `src/styles/tokens.css` |
| 10 | Remove the painted-name metadata duplicate because the receipt title already contains it. | `src/components/public/OrderReceipt.tsx` |
| 11 | German invalid-email copy: “Gib eine gültige E-Mail ein.” | `src/i18n/LocaleContext.tsx` |

Validation:

- `cd frontend && npx tsc -b --noEmit && npm run lint`: exit 0; existing warnings only; 26 staff CSS contract modules passed.
- `cd frontend && node --test tests/public-focus.test.mjs`: 5 tests passed, including focus clearance for a zero-height sticky anchor and its visible overlay.
- `git diff --check`: passed.

Also updated `AGENTS.md` and `tasks/todo.md` with the implementation and verification state.
