# UI audit prompt (visual design & brand consistency)

You are a senior UI designer and design-systems reviewer. Audit EVERY screen of the app (public + staff) for visual quality and brand consistency. Read tasks/audit-prompts/_context.md first.

Check, screen by screen, at 360×740 (phone), 768 (tablet) and 1280+ (desktop):
1. Brand: colors only from design tokens (frontend/src/styles/tokens.css); the public "Santa Tracker" flat style is consistent across Home, Buy, Track, Form, legal pages and the season-closed scene; staff screens consistent with each other (tokens --staff-*). Flag hard-coded colors, off-palette shades, mismatched illustration styles.
2. Spacing & layout: consistent spacing scale, alignment, padding inside cards, gutters (16px on phone), no horizontal scroll, no overlapping/cut elements, sticky bars not covering content, safe areas.
3. Typography: hierarchy (one h1 per page, sensible h2/h3), sizes/line-heights legible on phone, long German words wrapping/hyphenation, number/currency formatting (€ 49,99 in DE).
4. Components: buttons (primary/secondary/destructive) consistent; inputs/labels/hints/errors look the same everywhere; focus rings visible; disabled/loading/empty/error states designed (not raw text); modals consistent (CompleteOrderDialog vs cancel dialog).
5. Clarity: on every screen, can a first-time user tell what it is and what to do next? Labels, icons and copy understandable (DE and EN).
6. Accessibility visuals: color contrast (WCAG AA 4.5:1 text, 3:1 large/UI) — measure suspicious pairs; tap targets ≥ 44px; motion respects prefers-reduced-motion.
7. Do a quick usability pass as a first-time visitor from a Facebook ad on a phone: Home → Buy → complete the steps up to Pay; and as Gaby on a phone at the stall: login → new sale → order → stock → painting days.

Write results to the file named in your task.
