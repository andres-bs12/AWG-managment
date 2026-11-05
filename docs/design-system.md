# ArtWithGab public design system

**Version:** 1.0 · **Date:** 2026-11-05 · **Status:** normative specification; application migration is pending.

This is the source of truth for customer-facing UI: `/`, `/buy`, checkout return, `/form/:token`, `/track`, waitlist, legal pages, and their shared layout, dialogs and states. Staff UI: **later**. Code and comments must be English; customer copy must be localized German/English.

Use **must**, **must not** and the values below as implementation requirements. The [audit](design-system-audit.md) describes the current source, not completed fixes. This task changes documentation only. Proposed tokens and components below are not claims that they exist today.

## 1. Principles and precedence

| Rule | Required outcome |
|---|---|
| P1 · Premium, calm, warm, handmade | Warm opaque surfaces, generous grouping, flat artwork, quiet borders. Craft comes from the ornament, not gradients on controls, extra badges or decoration around every sentence. |
| P2 · Ornament first | One large illustrated ornament in the configurator; smaller static versions in review. Uploaded photos remain reference tiles and must never become the painted portrait. |
| P3 · One primary action per screen | One filled primary button in the current task area. Back, add, edit, copy and calendar actions are secondary/tertiary. Home uses **Track order** as primary and **Choose an ornament** as secondary. |
| P4 · Less text, never unclear | Each hint answers one question. Every choice has a label, every amount has a meaning, every error offers a recovery. Constraints belong at the decision they affect. |
| P5 · Proximity is meaning | Related elements must be closer than unrelated groups by at least one step of the spacing scale. Spacing is owned by the parent layout; never add child margins to parent gaps. |
| P6 · Honest state | An illustrative preview is not a promise of likeness; an API date is not a reservation; a Stripe return is not payment confirmation; a request is not proof of email delivery. |
| P7 · Same task, same component | `/buy` and the QR form reuse the same public primitives, not copied CSS. Keyboard, touch and assistive technology receive the same information. |

Precedence: owner decisions and product constraints in `AGENTS.md` → this document for public visual/content rules → the latest **Form design rules** in [sprint 6](sprint6-buy-ux.md#form-design-rules-public-forms-buy-form) and approved [premium plan](plan-buy-premium.md) → exploratory research. This document consolidates those decisions and supplies missing values. It does not authorize legal wording, new business rules or payment changes.

Resolved conflicts: use three `/buy` screens (Design, Delivery, Review & pay); mobile design has three substeps (Colour/finish, Back name, Pet/photos). Owner decision (2026-11-05): from 768px related personal-data fields share a row on the six-column grid (Name | E-Mail, Telefon, Straße | Stiege/Tür, PLZ | Ort), aligned with subgrid; below 768px one column except PLZ + Ort. Keep both the next three date cards and the calendar. Never put a reference photo on the ornament. Earlier research proposing five shop screens, photo compositing, invented evening hours, alternate payment labels or automatic date selection is superseded.

## 2. Tokens and colour

### 2.1 Token contract

All public design values must be declared in `frontend/src/styles/tokens.css`. CSS modules and inline UI styles must consume tokens: no raw pixel lengths, hex/RGB/HSL colours, private colour variables, arbitrary type sizes, shadow strings or duration values. Zero, percentages, fractions, `auto`, `inherit`, `currentColor`, `transparent`, intrinsic layout keywords and calculations from tokens are allowed. SVG viewBox/path geometry is unitless illustration geometry, not UI spacing. Media-query literals are the exact breakpoints in §5 (CSS custom properties cannot supply ordinary media-query conditions); no other pixel literals belong in modules. Artwork colours must also come from the centralized illustration palette; preserve existing shapes during migration.

Do not repurpose an illustration colour as a UI role, and do not import `--staff-*` into a public component. Stable existing space/font tokens remain. New `--color-*`, `--type-*`, `--size-*`, `--layout-*`, `--radius-*`, `--shadow-*` and `--dur-*` tokens below must be added by the implementation agent. Use aliases rather than duplicate literals.

### 2.2 UI palette and roles (required tokens)

| Token | Exact value | Role and permitted use |
|---|---|---|
| `--color-surface` | `#fffdf9` | Warm page panel; reuse current `--public-surface`. |
| `--color-surface-raised` | `#ffffff` | Cards, inputs, popovers, sticky bars. Opaque. |
| `--color-text` | `#152033` | Headings, body, labels; reuse `--public-ink`. |
| `--color-text-muted` | `#5c6b80` | Hints, captions, metadata, placeholders; reuse `--public-muted`; never lower opacity. |
| `--color-border` | `#c6cec9` | Decorative dividers and non-interactive card outlines only. |
| `--color-control-border` | `#738078` | Input, unselected option and secondary-button boundary. |
| `--color-primary` | `#1f7a4d` | Primary action, brand green; reuse `--green`. |
| `--color-primary-hover` | `#14553a` | Primary hover; reuse `--green-deep`. |
| `--color-primary-pressed` | `#14553a` | Primary pressed; press feedback is motion, not a new shade. |
| `--color-on-primary` | `#ffffff` | Primary text and icons. |
| `--color-selected` | `#14553a` | **The single selection colour**: the 2px selected boundary of every selectable control, including language options and item tabs. |
| `--color-selected-surface` | `#e9f4ee` | Background tint of a selected control (owner decision). Text stays `--color-text`. |
| `--color-selection-hover` | `#f4f9f6` | Hover surface of an unselected option; lighter than the selected tint so hover never reads as selected. |
| `--color-focus` | `#14553a` | Outer keyboard focus ring. |
| `--color-focus-gap` | `#ffffff` | Inner focus separation against a selected or primary control. |
| `--color-success` | `#14553a` | Confirmed success text/check. |
| `--color-success-surface` | `#e9f4ee` | Success alert surface; add explicit state text. |
| `--color-warning` | `#805515` | Recoverable warning text/icon. |
| `--color-warning-surface` | `#fff4d6` | Warning alert only. |
| `--color-error` | `#9a3b3b` | Errors, destructive action text, error boundary. |
| `--color-error-surface` | `#fff0ee` | Error summary/alert surface. |
| `--color-info` | `#152033` | Neutral informational text/icon; no blue information banners. |
| `--color-info-surface` | `#fffdf9` | Info background; ordinary supporting copy uses no background. |
| `--color-cart-surface` | `#eef4f8` | Pale blue product/cart/price summary context only; current `--snow`. |
| `--color-cart-ink` | `#243352` | Blue cart/price emphasis only; current `--night-2`. |
| `--color-disabled-surface` | `#f3f5f7` | Unavailable control surface. |
| `--color-disabled-text` | `#5c6b80` | Disabled copy still readable. |
| `--color-overlay` | `rgba(21,32,51,0.56)` | Modal scrim, never a text surface. |

**C1 · Selection:** choice cards, colour/finish chips, radio/checkbox indicators, segmented controls, item tabs, language options, calendar days and date cards must use one treatment (owner decision, 2026-11-05): **2px `--color-selected` boundary + `--color-selected-surface` tint + label weight 600**. Text stays `--color-text`. No checkmark, no filled dark-green block, no black or heavy border, and **never a second indicator inside the control** (no ring around a swatch, no inner outline). Unselected controls show a 1px `--color-control-border` boundary plus 1px of extra inline/block padding, so switching to the 2px selected boundary never shifts layout. The weight and boundary change are the non-colour cues (WCAG 1.4.1). A tab additionally uses `aria-selected`. A colour swatch keeps its ornament colour and has no ring of its own. Selected + hover/pressed keeps the same green. Selected + disabled uses the disabled treatment and a text explanation; do not imply an unavailable option can be submitted.

Dark green ties selection to the brand and action vocabulary. As a boundary it has 8.79:1 contrast on white (≥3:1 needed for UI components, WCAG 1.4.11), and the tint keeps body text at ≥14:1. Pale blue stays free for purchase summaries. Success also needs a status label/check, so it cannot be mistaken for selection.

**C2 · Blue:** blue UI surfaces/text are permitted only for cart, product summary or price context. Never use blue for selection, focus, help, delivery facts, an input background, general information or delivered status. `--color-text` is the existing dark ink, not an additional blue emphasis. The established sky/ridge/house palette is a separate **illustration-only** exception; it must never signal interactive state. On scene backgrounds, use an opaque neutral text backplate rather than assuming white text plus shadow passes contrast.

### 2.3 Contrast contract

Ratios below are calculated using WCAG sRGB relative luminance, rounded to two decimals, for opaque foreground/background pairs. They are not browser or whole-page certification. Normal meaningful text, including hints, must reach 4.5:1; UI boundaries/state indicators must reach 3:1 against adjacent surfaces. Do not lower opacity or layer these colours over scenery and reuse the listed ratio.

| Foreground / background | Ratio | Approved role |
|---|---:|---|
| `--color-text` / surface | 16.07:1 | All copy |
| `--color-text` / raised | 16.33:1 | All copy |
| Muted / surface | 5.34:1 | Hints and metadata |
| Muted / raised | 5.43:1 | Hints and metadata |
| Muted / cart surface | 4.89:1 | Cart secondary copy |
| White / primary | 5.32:1 | Primary action |
| White / selected or primary-hover | 8.79:1 | Selected control and hover |
| Selected / selection-hover surface | 7.80:1 | Unselected hover label |
| Control border / raised; surface | 4.13:1; 4.06:1 | Interactive boundaries |
| Error / error surface | 6.19:1 | Error alert |
| Warning / warning surface | 5.94:1 | Warning alert |
| Success / success surface | 7.80:1 | Success alert |
| Info / info surface | 16.07:1 | Neutral information |
| Cart ink / cart surface | 11.33:1 | Cart/price emphasis |
| Disabled text / disabled surface | 4.97:1 | Unavailable label |

Decorative `--color-border` does not meet the interactive-boundary requirement; do not use it as the sole input outline. Focus is `--focus: 0 0 0 3px var(--color-focus-gap), 0 0 0 6px var(--color-focus)` and must not be clipped. This replaces the current blue outer ring.

### 2.4 Ornament palette and finish

| Required token | Value | Required matching token | Value |
|---|---|---|---|
| `--ornament-red` | `#b03a2e` | `--portrait-red` | `#963126` |
| `--ornament-green` | `#2f6b3f` | `--portrait-green` | `#275b35` |
| `--ornament-beige` | `#d8c3a0` | `--portrait-beige` | `#bea780` |
| `--ornament-cap` | `#d2b66f` | `--ornament-hook` | `#a98948` |
| `--ornament-name-light` | `#ffffff` | `--ornament-name-dark` | `#5a4330` |
| `--ornament-highlight` | `rgba(255,255,255,0.55)` | `--ornament-glint` | `rgba(255,255,255,0.22)` |
| `--ornament-swatch-highlight` | `rgba(255,255,255,0.60)` | `--ornament-swatch-border` | `#738078` |

**C3:** each pet portrait's outer background disc must use the selected ornament's slightly darker matching tint, for both cat and dog. Keep the cream face medallion and pet artwork; remove species-specific green/blue discs. Before a colour is selected, beige is an **illustrative placeholder**, labelled “Choose a colour”; it is not a selected value. Grey/white on old orders must remain truthfully labelled as legacy, never silently rendered beige or offered for sale; add explicit legacy artwork tokens when migrating those orders.

Name lettering: white on red (6.02:1) or green (6.37:1); dark brown on beige (5.36:1). White on beige fails (2.33:1 on the portrait tint); never use it. Meaningful name text must also exist as regular accessible text.

Shiny: flat base + one upper-left specular arc (55% white) + optional single 300ms glint (22% white). Matte: flat base, no specular arc, glint, faux noise or arbitrary dot texture. The portrait does not change with finish. Finish swatches reuse these rules; shiny uses the centralized highlight over the chosen base, matte the base only. Do not suggest actual photographs or material accuracy beyond the approved illustrative style.

### 2.5 Migration table

Apply aliases first, then migrate public consumers, then remove deprecated aliases only after a repository-wide consumer check. Do not change unrelated consumers during this task.

| Existing token/value or duplicate | Required public replacement | Migration instruction |
|---|---|---|
| `--public-surface`, `--public-ink`, `--public-muted` | `--color-surface`, `--color-text`, `--color-text-muted` | Preserve exact current values; old names become temporary aliases. |
| `--green`, `--green-deep` | `--color-primary`, `--color-selected` / `--color-primary-hover` | Resolve by role; keep scene aliases for artwork. |
| `--snow`, raw `#eef4f8` | `--color-cart-surface` | Non-cart use migrates to neutral surface, not to this alias. |
| `--snow-2` as boundary/divider | `--color-control-border` / `--color-border` | Separate interactive and decorative boundaries. |
| `--night`, `--night-2` in UI | `--color-text` / `--color-cart-ink` | Neither may remain a selected/focus colour. |
| Buy-local `--select`, `--select-tint`, `--choice-line` | `--color-selected`, `--color-selection-hover`, `--color-control-border` | Remove local semantic palette. Selected chips keep 2px green boundary + light green tint (C1), with no swatch ring. |
| Public uses of `--staff-*`, raw `#9a3b3b` | Matching public semantic role | No cross-theme colour imports. |
| `#fff`, `white`; `#f3f5f7` | `--color-surface-raised`; `--color-disabled-surface` | Choose by role; do not replace illustration highlights with UI surface automatically. |
| `--focus` with `#2c5aa0` | New `--focus` formula in §2.3 | Preserve dual-ring geometry, replace blue. |
| Repeated red/green/beige hex in swatches/SVGs | `--ornament-*`, matching `--portrait-*` | One source for preview, review, receipt and form. |
| `--cta`, `--cta-press`, `--gift-blue`, `--wood*`, `--wreath`, `--berry*`, `--gold*`, `--pine*` | Keep as illustration-only aliases | Never primary-button/selection colours. |
| `--sky-*`, `--ridge-*`, `--haze`, `--snow-field`, `--snow-shade` | Keep existing values, illustration only | No need to repaint the approved scene. |
| Hard-coded artwork colours | `--art-hex-*` / `--art-rgba-*` in §13 | Use the exact migration registry; prefer existing scene/ornament aliases where listed. Do not visually redesign an asset during token migration. |
| `--fs-display`, `--fs-h1`, `--fs-h2`, `--fs-body`, `--fs-small` | `--type-display-size`, `--type-h1-size`, `--type-h2-size`, `--type-body-size`, `--type-hint-size` | Public uses adopt full role tuples; do not globally reinterpret old `--fs-h2` before checking consumers. |
| `--radius`, `--radius-pill`, `--public-card-radius` | `--radius-control`, `--radius-pill`, `--radius-panel` | Preserve 12px, 999px and 20px respectively. |
| `--public-card-shadow` and local shadows | `--shadow-1` / `--shadow-2` | Replace current 16px/40px panel shadow; no third elevation. |
| `--touch`, `--touch-lg` | Retain 44px / 56px | Use everywhere; do not reduce calendar hit width to 40px. |
| `--space-1` … `--space-8` | Retain existing values | Do not renumber; extend with `--space-9`, `--space-10`. |
| `0.12s`, `.15s`, `200ms`, `300ms`, `450ms`, `ease`, `--pop-ease`, `--scene-ease` in controls | Duration/easing tokens in §8 | Remove bounce from task UI; retain scene motion only within §8 limits. |
| `--motion` (currently defined only under reduced motion) | `--dur-reduced` and explicit JS preference handling | Retire this unused scalar for public controls after consumer check. |
| Inline control sizes/margins and local widths | §4–6 size/layout tokens | Remove compensating offsets; use shared parent grids. |

## 3. Typography

**T1:** retain `--font-display: 'Baloo 2', 'Trebuchet MS', 'Avenir Next Rounded', system-ui, sans-serif` and `--font-sans: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif`. Display is for headings; body font is for labels, data and controls. Load the needed weights; do not rely on synthetic 650 weight. Root font size stays user-controlled (default 16px).

For every row below, add **four exact tokens**: `--type-{role}-size`, `--type-{role}-line`, `--type-{role}-weight`, `--type-{role}-tracking`. The role column provides the literal `{role}`. Line heights are unitless; tracking values are `em`.

| Role | Family | Size | Line | Weight | Tracking | Use |
|---|---|---|---|---|---|---|
| `display` | display | `clamp(2rem, 6vw, 3.25rem)` | `1.10` | `800` | `-0.015em` | Home brand/title only |
| `h1` | display | `1.75rem` | `1.20` | `700` | `0em` | Public page title |
| `h2` | display | `1.625rem` | `1.25` | `700` | `0em` | Step title |
| `h3` | display | `1.25rem` | `1.30` | `700` | `0em` | Section/card title/section legend |
| `label` | sans | `1rem` | `1.40` | `600` | `0em` | Field/group label |
| `body` | sans | `1rem` | `1.50` | `400` | `0em` | Body and entered values |
| `hint` | sans | `0.875rem` | `1.45` | `400` | `0em` | Hint, error body, metadata |
| `caption` | sans | `0.75rem` | `1.50` | `600` | `0em` | Progress label/counter only; never legal terms or essential help |
| `price` | sans | `1.5rem` | `1.25` | `700` | `0em` | Main total; line-item amount uses body size + weight 600 |
| `button` | sans | `1rem` | `1.25` | `600` | `0em` | All action variants and selectable-control labels |

**T2:** prose max `--measure-prose: 65ch`; hints max `--measure-hint: 52ch`; headings max `--measure-heading: 28ch`. Never force a single line for essential copy. No arbitrary smaller text at 360px. Use sentence case in DE/EN, preserving German noun capitalization. No uppercase badges or letter-spaced field labels. Exceptions: EN/DE language codes, actual order codes and uppercase back names. Prices and numeric totals use `font-variant-numeric: tabular-nums lining-nums`; amounts stay together with non-breaking spacing and align to the right. Headings have no default browser margins; layouts supply the required gap.

## 4. Spacing and dimensions

### 4.1 Base scale

**S1:** all spacing is based on 4px. Retain the established nonlinear scale so existing token references remain valid. “One scale step” means the next entry in this table, not the next numeric multiple of 4.

| Token | Value | Token | Value |
|---|---|---|---|
| `--space-1` | `4px` | `--space-6` | `32px` |
| `--space-2` | `8px` | `--space-7` | `48px` |
| `--space-3` | `12px` | `--space-8` | `64px` |
| `--space-4` | `16px` | `--space-9` | `80px` |
| `--space-5` | `24px` | `--space-10` | `96px` |

### 4.1a Why these numbers (sources)

The scale follows the convention used by professional design systems:
- 4px base with fine steps up to 16px for component internals, then 8px+ steps for layout.
- Atlassian: `space.100` = 8px, `space.150` = 12px, `space.200` = 16px.
- IBM Carbon: 2/4/8/12/16/24/32/40/48 for components, 16–160 for layout.
- Material: 4dp grid.

Rules derived from that:
1. **Every distance is a token.** No 9.5px, 10px or 17.5px.
2. **Insets are symmetric** unless the concentric rule applies. An element inside a rounded container sits concentric with the container's corner, so inner radius = outer radius − inset, and inset = (container height − content height) / 2.
3. **Centring is exact by construction:** fixed height token + flex centring + symmetric padding tokens. Tests assert the computed padding and gap equal the tokens; there is no pixel tolerance.
4. **Internal ≤ external:** a component's internal padding is never larger than the gap separating it from unrelated neighbours (Gestalt proximity).
5. **Target size:** 44px minimum, from Apple HIG and WCAG 2.5.5. Controls default to 48px (`--size-control`), which also matches Material's 48dp touch target.

### 4.2 Mandatory relationships

All gaps are measured from the rendered edge of one element to the next. The table is mandatory, not a menu. Error/hint rows participate in flow. Do not sum `Field` bottom margins with grid gaps or cancel them with negative margins.

| Relationship | Exact required spacing | Owner |
|---|---|---|
| Label → hint | `--space-1` = 4px | Field |
| Last of label/hint → control | `--space-2` = 8px | Field |
| Control → error or count | `--space-2` = 8px | Field |
| Field → next field | `--space-5` = 24px | FieldGroup parent; Field has no external margin |
| Related field group → next field group | `--space-6` = 32px | Section body |
| Section → unrelated section | 32px + `--border-thin` divider + 24px = 57px | SectionGroup parent; exceeds twice the 24px field gap |
| Page h1 → lead | 8px | PageHeader |
| PageHeader block → progress/content | 24px | Page layout |
| Step h2 → content | 24px; if an intro follows, 8px to intro then 24px to content | Step layout |
| Section h3/legend → content | 16px | Section |
| Card header → body | 16px | Card |
| Card inner padding | 16px below 768px; 24px from 768px | Card |
| Card → card in same collection | 16px | CardList |
| Tabs → add button | 16px minimum horizontally; on wrap 16px vertically | ItemTabs wrapper |
| Complete item toolbar (tabs + add) → editor | 24px | Configurator |
| Segmented control → following content | 24px | Parent stack |
| Image/preview → its side control | 12px | OrnamentPreview |
| Preview side control → disclaimer | 8px; complete preview → next unrelated block 24px | OrnamentPreview/parent |
| List items / review detail rows | 12px gap; review rows have 12px block padding and 1px separator instead of another gap | List/ReviewCard |
| Buttons in a group | 12px; 24px from preceding form content | ActionGroup |
| Chips / choice cards / date cards / photo tiles / calendar rows | 12px / 12px / 12px / 12px / 4px | Control-specific layout |
| Page gutter at 360px | 16px | PublicPage |
| Page gutter at 768px | 24px | PublicPage |
| Page gutter at 1280px | 32px | PublicPage |
| Page top/bottom | 24px / 48px, plus sticky-bar clearance if present | PublicPage |
| Sticky bar padding | 12px block, 16px inline below 768px; 16px block, 24px inline from 768px | StickyActions |
| Sticky bar bottom safe area | `max(var(--space-3), env(safe-area-inset-bottom))` | StickyActions replaces bottom padding; does not add twice |
| Reading/form/status/desktop configurator max widths | 680px / 760px / 440px / 1100px | §4.3 tokens |

**S2 · Proximity:** label/hint/control belong more tightly than fields (4/8 versus 24); fields belong more tightly than groups (24 versus 32); sections use the divider separation. A new ornament button must never touch a `Kugel 1` tab or appear to label it. Group headers and children may use the exact table exceptions above; arbitrary 10px, 14px, 18px and 20px gaps are not permitted.

### 4.3 Dimension tokens

| Token | Exact value | Use |
|---|---|---|
| `--layout-reading-max` | `680px` | Legal/prose |
| `--layout-form-max` | `760px` | Delivery/review/form |
| `--layout-status-max` | `440px` | Waitlist, short success/error panel |
| `--layout-configurator-max` | `1100px` | Two-column design/Track composition |
| `--layout-field-max` | `34rem` | Text field width; never stretch beyond expected reading width |
| `--layout-postcode-max` | `8rem` | Postcode input, `max-width:100%` |
| `--layout-calendar-max` | `420px` | Month grid |
| `--layout-gutter` | `16px`; `24px` at 768px; `32px` at 1280px | Responsive root alias |
| `--layout-header-height` | `64px` | Minimum header height; allow content growth |
| `--layout-sticky-gap` | `0px` | Gap between the scrollport and the docked mobile action bar (none: the bar continues the card) |
| `--touch`, `--touch-lg` | `44px`, `56px` | Minimum target; large primary button |
| `--size-control` | `48px` | Default input/select/button height; min-height, not fixed multiline height |
| `--size-textarea-min` | `96px` | Resizable textarea |
| `--size-choice-card` | `72px` | Minimum choice-card height |
| `--size-date-card` | `88px` | Minimum date-card height |
| `--public-sticky-top`, `--public-sticky-bottom` | `0px`, `0px` initially | Runtime measured obstruction dimensions; update when sticky regions mount/resize |
| `--size-check` | `24px` | Checkbox/radio graphic within 44px target |
| `--size-icon-sm`, `--size-icon` | `16px`, `24px` | Inline/support icon, standalone icon |
| `--size-help-glyph` | `24px` | Visible (?) inside 44px button |
| `--size-swatch` | `24px` | Colour/finish swatch |
| `--size-photo` | `76px` | Photo and add tile |
| `--size-review-art` | `76px` | Review preview column |
| `--size-preview-mobile`, `--size-preview-desktop` | `140px`, `280px` | Ornament artwork max height/mobile, max width/desktop |
| `--size-preview-success` | `150px` | Static success art |
| `--size-step-marker` | `32px` | Non-interactive progress marker |
| `--size-progress-rail` | `4px` | Substep bar/connector |

## 5. Layout and grid

**L1 · Breakpoints:** mobile `<768px`, medium `768–1023px`, desktop `≥1024px`, wide `≥1280px`. Store matching documentation tokens `--breakpoint-md:768px`, `--breakpoint-lg:1024px`, `--breakpoint-xl:1280px`; ordinary CSS media queries use those exact literal thresholds. No 500/640/720/860/900px public UI breakpoints. Illustration detail may use `1600px` (`--breakpoint-scene-wide`) and short-height adaptations at `640px`/`700px` (`--breakpoint-short-height`/`--breakpoint-compact-height`); these must not change form structure or type roles.

**L2 · Six-column form grid:** use `repeat(6,minmax(0,1fr))`, 16px column gap. Below 768px every field spans six columns, except postcode (2) + fixed city (4). From 768px (owner decision): Name 3 | E-Mail 3; Telefon 3; Straße 4 | Stiege/Tür 2; PLZ 2 | Ort 4. If a pair cannot fit at text zoom, stack it.

Within every side-by-side pair, both fields use four shared `subgrid` rows: label, hint, control, error. Put hint margins and control/error spacing inside those rows; empty hints have zero content. Align label baselines and control tops. Without subgrid support, stack the pair; do not re-create alignment using fixed heights. A static city value occupies the control row and the same min-height as a field, with a visible city label. Address order is street, staircase/floor/apartment (optional), postcode + Vienna.

**L3 · Configurator:** below 1024px show a compact preview then the current substep. From 1024px, use `minmax(0,5fr) minmax(0,7fr)` columns with a 32px gap: preview left, one-column form right; content max 1100px. The preview column is sticky and vertically centred in the viewport. It holds the ornament, the single price summary and a 3-line reassurance list. No empty column areas at 1280×800 or 1440×900. Delivery/review remain max 760px. Sticky preview top is the actual sticky header height + 16px if a sticky header exists, otherwise 16px. Header is not sticky by default. Desktop price summary uses the same offset; show a single price summary rather than another floating primary action.

**L4 · Safe areas:** page inline padding is `max(var(--layout-gutter),env(safe-area-inset-left/right))`. Do not apply panel padding a second time to the calendar: seven 44px targets must fit a 360px viewport. At this width, place the calendar in the full 328px page content region, outside nested padded cards. At 320px or zoom, place the same date selection in a readable list if seven 44px columns do not fit. No horizontal page scrolling or overlapping targets.

Below 1024px, allow a sticky bottom action bar only while it leaves the active field, error and keyboard usable. Measure actual header/preview/bar heights with layout observation; expose `--public-sticky-top` and `--public-sticky-bottom` as runtime dimensions and use them for scroll padding, scroll margins and reserved clearance (plus 16px). Do not hard-code `10rem`. If short viewport, keyboard or zoom leaves insufficient reading room, unstick the preview first, then actions. At ≥1024px actions are in normal flow. Never trap the user between two oversized sticky regions.

## 6. Shape, border and elevation

| Tokens | Exact values | Required mapping |
|---|---|---|
| `--radius-small` | `8px` | Popover, inset error summary |
| `--radius-control` | `12px` | Button, field, card, tile, segmented group/tab |
| `--radius-panel` | `20px` | Outer page panel/dialog |
| `--radius-pill` | `999px` | Chip only |
| `--radius-circle` | `50%` | Ornament/swatches/calendar marker, not arbitrary decoration |
| `--border-thin`, `--border-control`, `--border-inset` | `1px`, `2px`, `4px` | Divider/card, interactive boundary, inset note |
| `--shadow-1` | `0 4px 12px rgba(21,32,51,0.10)` | Outer reading panel or sticky bar, not every nested card |
| `--shadow-2` | `0 16px 40px rgba(21,32,51,0.16)` | Dialog/popover only |
| `--shadow-none` | `none` | Default nested cards and controls |
| `--z-scene`, `--z-content`, `--z-header`, `--z-sticky`, `--z-popover`, `--z-modal` | `0`, `1`, `2`, `3`, `4`, `5` | Shared layer order; modal portalled above page |

**SH1:** only two elevation levels. A focus ring is an accessibility indicator, not a third elevation. Dividers are 1px solid `--color-border`, full content width, with the section/row spacing table. Dashed borders mean “add photo” or “unavailable”; never random section separators. Selected boundaries retain 2px in all states to prevent layout shift. Cards are flat; controls do not use gradients, glow or inset double rings.

## 7. Component contracts

Paths below are relative to `frontend/src/`. **Existing** is the current implementation location, even when it needs migration. **Proposed** names a future shared file; it is not implemented by this documentation. Reuse the existing component when possible instead of introducing a competing primitive.

### 7.1 Shared state matrix

**CMP0:** every interactive component below inherits this table; the component-specific rules refine it. Static components have no hover/focus/pressed/selected/disabled states; do not fabricate interactivity for them. Their embedded buttons/links follow the relevant control contract.

| State | Required treatment |
|---|---|
| Default | Raised surface, ink text, 1px control boundary (+1px padding compensation; see C1). Primary buttons use primary green; tertiary/link have transparent boundary. |
| Hover | Only with hover-capable pointer: selection-hover surface, selected-green label/border; primary uses primary-hover. Selected controls retain selected treatment. Never rely on hover to reveal instructions. |
| Focus-visible | Dual `--focus` ring, including when selected, invalid or hovered; native hidden radio transfers ring to visible label. No clipped ring. |
| Pressed | 100ms `scale(0.97)` and back for buttons/cards; do not move layout. Selected green remains. Reduced motion: instantaneous state without scale. |
| Selected | C1: 2px green boundary + light green tint + label weight 600, no check, no inner ring; correct `checked`, `aria-selected` or `aria-current` semantics. Never use `aria-pressed` to substitute for radio keyboard behaviour. |
| Disabled | Disabled surface/text, dashed boundary for unavailable choices, explicit reason (“Ausverkauft”/“Sold out”), no opacity reduction or press/hover response. Native `disabled`; no enabled-looking mystery. |
| Error | Error boundary + associated text/icon, not colour alone; preserve selected value and answers. Focus ring remains. Buttons point to field/summary errors rather than turning red on failed validation. |
| Busy | Preserve dimensions and label meaning, localized status, `aria-busy`; guard duplicate actions. Never imply success while waiting. |

### 7.2 Button and link

**Implementation:** existing `components/ui/Button.tsx`, `ButtonLink.tsx`, `Button.module.css`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Optional 24px icon, label, optional busy indicator; 8px gap. Default min-height 48px, large 56px, all hit areas ≥44×44px. Inline padding 16px/24px for default/large. Multiline label may increase height. |
| Variants | Primary: primary/on-primary. Secondary: raised/ink, control border. Tertiary: transparent/ink, no visible border. Link: underlined ink with 4px underline offset, transparent border, 44px standalone hit area. `ghost` is the existing name for tertiary and may remain an API alias. |
| States | CMP0; hover secondary/tertiary/link uses selection-hover, focus dual ring. Link pressed does not remove underline. Normal actions have no selected state; toggle controls use their own contract. Unavailable links render explanatory text, not a fake disabled anchor. |
| Spacing | 12px action-group gap; 24px above group. Mobile primary stretches after supporting actions have room; semantic focus order matches visual order. |
| Do / do not | Use button for mutations, router anchor for navigation. Keep Continue enabled to reveal validation errors; disable only for genuine busy/unavailable operations. One primary action, no page-specific font/gradient overrides. Final DE payment label remains “Zahlungspflichtig bestellen”, EN “Order and pay”; amount may follow with a middle dot. This preserves the agreed label, not a new legal conclusion. |

### 7.3 Choice card and chip

**Implementation:** existing `components/ui/ChoiceList.tsx/.module.css`; bespoke chips currently in `pages/public/buy/BuyItemsStep.tsx` and `BuyPage.module.css`. Proposed reusable chip/variant belongs with `ChoiceList`, not a second palette.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Visible legend, native radio/checkbox, swatch/icon, label, optional hint/reason, selected check. Choice card min-height `--size-choice-card` (72px), padding 16px, 12px gap. Chip height `--size-control` (48px), the same as inputs and buttons, so every chip in a group has one height. The content is one line, centred with flex. Sold-out text goes on the same line as a secondary label; it is never a second line that stretches siblings. Padding follows the **concentric rule**: the 24px swatch sits concentric with the pill's end cap, so its inset is (48 − 24) / 2 = 12px (`--space-3`) at the leading edge and vertically, with 16px (`--space-4`) after the text at the trailing edge. Content gap 8px. The swatch has no border ring when selected. |
| States | CMP0. Checked hint becomes white. Disabled choices stay visible with reason. Invalid group associates one error and focuses its first enabled choice. Hover/focus preview may update illustration temporarily; it must not change price, submitted choice or checked state. |
| Spacing/usage | Chip gap 12px (`--space-3`) in both directions, the same as choice cards. Group gap 32px. Legend→options 8px. Prefer one row of wrapping labelled swatches, not a colour-only picker. Never render the check column empty or collapse options without a specific “Change colour” action. |

### 7.4 Segmented control

**Implementation:** existing `components/ui/SegmentedControl.tsx/.module.css`; replace preview-local `.segment` in `components/public/OrnamentPreview*` with this public implementation.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Labelled fieldset, adjacent equal-width native radio labels; 4px group padding, 4px internal gap, each segment min-height 44px, 16px inline padding; group/control radius 12px. |
| States | CMP0. One selected side, C1 green + check. Arrow keys select within native group; Tab enters/leaves. If custom roles are unavoidable, implement roving tabindex and full APG radio keys; never expose both radio and pressed semantics. |
| Spacing/do/don't | Preview→control 12px; control→hint 8px; complete block→next content 24px. Use for Front/Back or language, never unrelated actions. Keep two segments side by side at 360px; no arbitrary 140px wrapping basis. |

### 7.5 Field: input, select, textarea, checkbox, radio

**Implementation:** existing `components/ui/Field.tsx/.module.css`; shared public `FieldGroup`/address composition is proposed.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Persistent label → optional hint → control → optional error/count. Input/select min-height 48px, padding 12px; textarea min-height 96px, resize vertically. Text max 34rem; postcode max 8rem. Select retains recognizable arrow and native keyboard interaction. |
| Association | Stable id/label; merge existing `aria-describedby` IDs with hint/error IDs, never overwrite. `aria-invalid` only when invalid. Field must support an explicit control ID/props interface for composite controls, not depend solely on cloning a direct DOM child. Checkbox/radio uses native input in a 44px labelled row; graphic 24px, gap 12px; grouped options have fieldset/legend. |
| States | CMP0. Focus dual ring; invalid red border + localized recovery. Validate on blur after interaction and on Continue; clear stale error while editing, do not mark valid until rechecked. Valid check is supplementary; never announces success on each keystroke. |
| Spacing/do/don't | Exact §4.2; Field has no external margin. Optional is written “(optional)” in label, no blanket required-fields paragraph. Correct autocomplete/type/inputmode; no placeholders as labels. Do not silently remove invalid characters or truncate a suggested back name without showing the choice. Shared policy accepts the backend's supported 1–6 letters and displays uppercase; preserve input and explain errors. |

### 7.6 Help (?) popover

**Implementation:** finish help currently in `BuyItemsStep.tsx`; proposed `components/ui/HelpPopover.tsx/.module.css` shared by all constraints.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Real button displaying `(?)` or a 24px outlined question glyph in a 44×44px hit area, 4px from its label; accessible name identifies the topic. `aria-expanded` and `aria-controls`; content panel max `--measure-hint`, padding 16px, radius 8px, shadow-2 if overlaid. |
| States/keyboard | CMP0 button states; open panel is neutral, not a selected option. Toggle by click/Enter/Space, Escape closes and returns focus to trigger, outside click closes. Inline disclosure is preferred at narrow widths; no clipping or overlap with target neighbours. Use labelled disclosure/popover semantics; explanatory text is not a hover-only tooltip. |
| Content/spacing | 8px trigger→panel, 24px whole group→next block. No focusable controls inside this simple help panel. Visible “Vienna delivery” constraint once beside date selection, postcode range and evening/no fixed time details in this help. Do not repeat the same explanation in date lead, address inset and review. |

### 7.7 Inset note

**Implementation:** existing `.inset`, `.notice`, `.explanation` in `BuyPage.module.css`; proposed `components/ui/InsetNote.tsx/.module.css`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | 4px neutral control-border on inline start, no background/shadow, ink body text; padding 4px block and 16px inline start. Body role, max 65ch. |
| States/spacing | Static; an asynchronous update may use polite status. 8px internal paragraph gap, 24px above/below unrelated content. At most one inset per screen/substep; combine related notes, do not stack banners. |
| Do/don't | Use for contextual photo-reload or approved must-know policy. No blue boxes, decorative info dots, error-red styling or repeated Vienna notice. |

### 7.8 Alert and error summary

**Implementation:** current inline alerts across public pages; proposed `components/ui/Alert.tsx`, `ErrorSummary.tsx` and shared styles.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Semantic icon 24px + short heading + body/recovery action; padding 16px, 12px icon gap, radius 8px. Error/warning/success use corresponding semantic pairs; info is neutral. |
| States | Static presentation: error/warning/success/info; loading belongs to Loading. Hover/focus/pressed apply only to embedded actions. Blocking summary is focusable with `tabIndex=-1`, error heading and a list of links naming failed fields; each leads to its actual control or visible radio. |
| Spacing/do/don't | Summary at top of current task, 24px before content; 8px heading→list, 8px list gap. On failed Continue/Submit focus summary, then allow links to fields; one assertive announcement, not summary plus many simultaneous `role=alert` messages. Preserve answers. Stock/date failures explain how to choose again. |

### 7.9 Card, product card and review row

**Implementation:** `BuyItemsStep.tsx`, `BuyReviewStep.tsx`, `BuyPage.module.css`; `FormPage.tsx`/`Panel.module.css`; `OrderReceipt.tsx/.module.css`. Proposed shared `components/public/ReviewCard.tsx` and `components/ui/Card.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Optional h3/header action, body; 16px mobile/24px desktop padding, 12px radius, 1px decorative border, opaque raised surface, no nested shadow. Product/cart variant alone may use cart blue. Header→body 16px; card→card 16px. |
| Review alignment | Product row grid: `var(--size-review-art) minmax(0,1fr) max-content`, 12px column gap, top alignment. Amount right aligned, tabular, no wrap. Name surcharge, metadata and edit actions use the **same parent columns/subgrid**, starting in column 2, amounts in column 3. Never fake alignment with `margin-left:calc(56px + gap)`. At narrow text zoom, price may move below content in column 2, aligned end, without clipping. |
| Change actions (owner decision 2026-11-05) | **One** “Ändern”/“Change” per card, in the header next to the title (`ReviewCard` `action`). Its accessible name contains the visible word and names the section: “Kugel Luna ändern” / “Change ornament Luna”, “Lieferung ändern”, “Kontakt ändern”. It opens the whole section (ornament → its tab, first substep; delivery/contact → screen 2 at that field). Never one button per attribute. The button keeps a 44px target with negative block margins so the header stays one text line high. |
| Compact rows | Combine attributes (“Farbe & Oberfläche: Rot · Glänzend”); never repeat what the product row already shows (the pet name); photos are thumbnails without a heading. Phones: label (muted, hint size) above value; from 768px two aligned columns 2fr/3fr. |
| States/do/don't | Card itself is static, unless explicitly a ChoiceCard. Changed row may fade once (200ms); it must not become selected green. Show ornament, colour + finish, pet, separate name surcharge, delivery, contact and totals accurately. Fixed order facts in `/form` are read-only with explicit text, not disabled controls. No live preview buttons or duplicated disclaimer in review. |

### 7.10 Multiple-item tabs and add action

**Implementation:** `BuyPage.tsx` `.itemTabs`/`optionsPane` and `BuyItemsStep.tsx`; proposed `components/public/ItemTabs.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Owner decision: one toolbar row `[Kugel 1] [Kugel 2] [+ Kugel]`. The add control is a separate secondary button (dashed 1px boundary = “add”, like the photo + tile) placed directly after the last tab, outside the tablist. Its visible text is “+ Kugel” / “+ Ornament” and its accessible name is “Weitere Kugel hinzufügen”. The row is shown even with one ornament, so customers discover it. Each element is `--size-control` (48px) tall with 16px inline padding. Gaps are 12px between tabs and 12px before the add button. On narrow screens the row scrolls inside itself, never the page. Whole toolbar→editor **24px**. |
| States/keys | C1 selection; `role=tablist`, tab `aria-selected`, `aria-controls`, roving tabindex, labelled tabpanel. Left/Right/Home/End navigation, manual Enter/Space activation; no removal from an unlabeled icon. Add focuses new tab/editor; removing active item focuses adjacent item or add action. Preserve unsaved choices per item. |
| Do/don't | Add is an action outside tablist, never a tab. On max count disable with visible reason, keep readable. Item-specific error adds error text/icon without replacing selected state. Never place add in a different hidden substep or leave it glued to a tab. |

### 7.11 Calendar and date cards

**Implementation:** `pages/public/buy/BuyDateStep.tsx` and `BuyPage.module.css`; proposed `components/public/DeliveryDatePicker.tsx`.

| Contract | Rule |
|---|---|
| Delivery method (owner decision 2026-11-05) | The delivery screen starts with two C1 choice cards: “Lieferung in Wien” (Mi & Fr abends · fee) and “Abholung am Markt” (kostenlos). Vienna = earliest card + calendar + address. Market = stall days as C1 cards grouped under one quiet market heading (“Rathausplatz · Stand 12”, said once, never on every card; card = “Sa, 28. Nov” + “12:00–19:00 Uhr”), 2 columns on phones, 3 from 768px, 4 from 1024px; then “Wann kommst du?” time chips every 30 min from opening until 30 min before closing (4 columns on phones, 7 from 768px, text-only chips with tabular numbers); contact fields only, no address, no fee. Switching method clears date and time. Choice card inset 16px = padding + border (1px → 2px never shifts text). |
| Anatomy/sizes | Visible date legend, **one** “Frühester Termin” shortcut card (owner decision 2026-11-05: never three near-duplicate shortcuts), month grid starting Monday, one selected-date card and optional error. Date card min-height `--size-date-card` (88px), padding 12px. Calendar max 420px, seven equal columns, **44×44px targets**, 4px row gap, no inline gap at the narrowest layout. Card list→calendar 24px; month heading→grid 16px; calendar→summary 16px. |
| One selection | One ISO date state drives cards and grid. No independent preselection; earliest card gets an “Earliest” text label, not selection styling. Cards are shortcut buttons (`aria-pressed` synchronized with state), calendar uses native radios with one name. Choosing either updates both, including the persistent summary. No duplicated competing radio sets. |
| States | CMP0, same C1 selection (2px green boundary + tint) in date cards and calendar day. Unavailable days have readable muted text, no target/focus. Available unselected days have control-border outline; “available” is not green-filled. Loading skeletons reserve dimensions; fetch error has Retry; zero dates has waitlist/recovery action. |
| Summary/semantics | The choice is shown in a “Dein Termin” card below the calendar/time chips: dashed neutral placeholder (“Wähle einen Tag im Kalender”) before a choice, C1 selected style after (“Mi, 2. Dez · abends” or “Rathausplatz · Sa, 28. Nov · 15:30 Uhr”). No stray (?) under the lead paragraph: the lead says the constraint in one sentence. Full weekday/date/year in the radio accessible name and review when needed; use an additional visually hidden summary description when the compact visible line omits the year. Announce selected-date summary politely; keep calendar selection visible even if the chosen date is outside the first three cards. Allow wrapping at zoom. |
| Do/don't | Render API dates, including approved exceptions, never infer eligibility just from weekdays. No invented hour range, fake reservation or navigation to empty months. At insufficient width use accessible date list with same state. Never erase a disappeared date silently: explain and offer another while preserving other answers. |

### 7.12 Photo tiles and plus tile

**Implementation:** `BuyPetStep.tsx`, `FormPage.tsx`; proposed `components/public/PhotoTiles.tsx` shared implementation.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Visible group label, 4px→hint, 8px→wrapping tile list, 12px tile gap. Every thumbnail and trailing add tile 76×76px, 12px radius. Add tile: 2px dashed control border, raised surface, 24px plus icon; accessible “Add photo, 2 of 6”. Remove uses 24px close glyph in non-overlapping 44px button. |
| States | Default empty list contains one add tile; hover/focus/pressed CMP0. No selected state unless a real reference-selection feature is introduced. During read, placeholder tile with `aria-busy` and visible localized status; preserve successes when another file fails. At six replace add tile with “6 von 6 Fotos”; disabled/busy is explained. Error under tiles at 8px, associated to group and picker. |
| Do/don't | Meaningful alt “Foto 1 von Luna”; no camera filenames as primary alt. Hint “1–6 Fotos, hell und scharf.” Put actual accepted types/limits in associated help; do not promise unsupported HEIC handling. Gallery/camera uses platform picker, no forced capture in shared default. Reload warning appears once after files exist or restoration needs them. Uploaded images never appear on ornament artwork. |

### 7.13 Stepper and progress

**Implementation:** existing `components/ui/ProgressSteps.tsx/.module.css`; replace private Buy stepper with a variant of it.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Labelled nav + ordered list, equal columns, 32px number/check markers centred above captions, 8px label gap, 4px connectors; 24px before/after. Mobile compact variant displays “Schritt 1 von 3 · Deine Kugel” as visible text, not unexplained dots alone. |
| States | Upcoming: neutral outline/text; current: selected green with number plus `aria-current=step`; complete: green check and accessible “completed”. These are progress states, not extra buttons. If completed steps are navigable, use real 44px targets with CMP0 focus/hover/pressed, explicit names; future steps are static. |
| Substeps/do/don't | Progressbar has min/max/value and localized value text (Colour & finish, Back name, Pet & photos); update immediately, animate rail with transform for 200ms. Focus new step/substep heading and update document title. Non-interactive focused heading may suppress ring; controls never do. Same primitive supports `/form`'s necessary steps and Track timeline, without forcing identical step counts. |

### 7.14 Sticky bottom bar

**Implementation:** `.actions`, `.mobileTotal` in `BuyPage.module.css`; proposed `components/public/StickyActions.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Current total + secondary Back + one primary Continue/Pay, 12px gap, wrapping label-safe layout. Padding and safe area follow §4.2. No fixed height. |
| Docked / stuck (owner decision 2026-11-05) | Below 1024px the docked bar is the card's own bottom row: exactly the card's border-box width, flush with the screen bottom, top corners `--radius-panel`, bottom corners square, `--shadow-up`, and the scrollport ends exactly at its top (`--layout-sticky-gap: 0`), so nothing ever sits underneath it. Inner padding equals the card padding so buttons line up with the content. When the end of the card scrolls into view the bar returns to the flow as the card's last row (`data-stuck`): 1px `--color-border` divider on top, bottom corners equal the card radius, no shadow. The switch keeps every content position. Never a “pill inside a pill”. |
| States | Bar static; buttons CMP0, total Price contract. Busy primary preserves size and prevents duplicate checkout. Error summary stays in task, never hidden beneath bar. Selection is not applicable to container. |
| Do/don't | Below 1024px sticky only when enough room; measure and reserve actual height, test keyboard. Hide duplicate preview/cart total in that viewport. Review breakdown may show the total and the pay label may include it; these are meaningful review/payment contexts, not multiple floating counters. No duplicate primary button or conflicting padding overrides. |

### 7.15 Price and total

**Implementation:** `components/public/AnimatedPrice.tsx`, `components/public/OrderReceipt*`, `lib/money.ts`, and current local formatters in `FormPage.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Description + right-aligned amount; body/600 line amounts, price role main total, 8px before total divider and 12px row padding. `dl` for breakdown. Separate base items, each name extra, delivery (“Gratis”/“Free” only if zero), final total. Source all prices from API. |
| States | Static by default; visual count-up at most 200ms, underlying amount and accessible text update immediately. Announce only final total politely once, not every animation frame. Reduced motion instant. Loading uses placeholder, error/unavailable shows reason, never a false €0.00. No selected/hover/pressed state. |
| Do/don't | Shared currency formatter implements §10 exactly for all pages/receipts; never locale-dependent prefix/suffix drift. Tabular numerals, no-wrap amount. Only cart/price context gets pale blue. Updating total must not shift focus. |

### 7.16 Ornament preview

**Implementation:** `components/public/OrnamentPreview.tsx/.module.css`, `PetFaces.tsx`; unify product rendering with `PetOrnamentMini.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Stage, ornament, side selector when relevant, one honest disclaimer. Mobile art max-height 140px, desktop width max 280px, review 76px, success 150px; reserve aspect ratio. Use colour/finish/name tokens in §2.4. Caption hint role, 8px from side control. |
| States | Unconfigured placeholder explicitly labelled; hover/focus on enabled choices temporarily previews without committing; pointer leave/blur restores. Committed colour updates instantly with 200ms layered opacity transition. Back-name enable may flip once for 450ms; name updates immediately as typed. Button states come from SegmentedControl. No disabled fake product; invalid choices remain explained beside controls. |
| Do/don't | Interactive variant has accessible description naming colour, finish and side; static review variant has no hidden buttons, no repeated disclaimer and no motion. Cat/dog illustrations alternate via 200ms fade on a 10s cycle, paused on interaction; §8 requires a pause mechanism for continuing motion. Never present an uploaded photo as painting. No idle sway in task UI. |

### 7.17 Page header and public shell

**Implementation:** `layouts/PublicLayout.tsx/.module.css`, `HomePage.tsx/.module.css`, `Panel.module.css`; proposed shared `components/public/PageHeader.tsx` and `PublicPage.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Header: home link/brand + labelled language SegmentedControl, min-height 64px, responsive gutter. Task PageHeader: one h1 + optional lead, 8px gap, 24px to progress/content. Opaque surface/contrast backplate over scene. |
| States | Header/container static; links and locale controls CMP0. Current language exposed as checked state, not just `data-on`. Route transition focuses meaningful heading; preserve entered data when changing language. |
| Do/don't | Home may use display typography and illustrated street; task pages use calm backdrop. Footer legal/help links wrap with 12px gap and standalone 44px targets. Never truncate essential copy, insert arbitrary stars next to actions, or create a second nested main landmark. |

### 7.18 Loading and skeleton

**Implementation:** `OrnamentLoader.tsx/.module.css`, `.dateSkeleton` in `BuyPage.module.css`; proposed `components/ui/Skeleton.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Reserved final geometry + neutral disabled-surface shape; `aria-hidden` skeleton, container `aria-busy`, one localized `role=status` sentence. Ornament loader may be 36px artwork inside a 64px reserved region (new tokens `--size-loader-art:36px`, `--size-loader-region:64px`). |
| States | Busy versus timeout/failure; no fabricated hover/focus/pressed/selected/disabled. Skeleton is static by default; optional 200ms entrance fade, no continuous shimmer. Actual actions retain their focus and dimensions. |
| Do/don't | Do not delay resolved data for a decorative animation. Never put an empty status region on screen with no loading text. Hide old skeleton semantics after content arrives. |

### 7.19 Empty and error states

**Implementation:** branches in `BuyPage.tsx`, `FormPage.tsx`, `TrackPage.tsx`, `WaitlistPage.tsx`, `SeasonClosed.tsx`; proposed `components/public/PublicState.tsx` using PageHeader/Alert/Button.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Meaningful h1, one short explanation, one recovery primary action; optional static 76px ornament; status max 440px, common panel padding. 8px heading→copy, 24px→action. |
| States | Distinguish empty availability, loading, network error, expired link, read-only order and season closed. Use warning/error semantics as appropriate; retry actual operation without clearing answers. No selected state. |
| Do/don't | No success title for missing checkout code, no painting animation for unknown order, no duplicate error behind and inside modal. A non-retryable expired token explains next action; never repeatedly submit an invalid token. Season waitlist uses shared Field with contextual email purpose. |

### 7.20 Success and timeline

**Implementation:** `BuyThanksPage.tsx`, done branch of `FormPage.tsx`, `TrackPage.tsx`, `WaitlistPage.tsx`; share `ProgressSteps`, code block and proposed `components/public/OrderSuccess.tsx`.

| Contract | Rule |
|---|---|
| Anatomy/sizes | Confirmed-state h1 + one next-step sentence, optional static 150px preview, ordered timeline, code/copy + Track action, optional calendar download/feedback. 24px between blocks; timeline items 12px. Code is selectable; no forced tiny text for long code. |
| States | Pending confirmation: say so once, accessible status. Paid: only server-confirmed. Timeout: unconfirmed with Track recovery, not failed/paid claim. Saved QR form: confirms saved details, never claims payment. Waitlist: confirm/unsubscribe result distinct. Timeline uses current/completed/upcoming text and `aria-current=step`; never assume “Being painted” from payment alone. |
| Do/don't | One primary next action; copy/calendar/SEQ secondary. Success feedback is polite, no confetti/dots without meaning. Calendar uses confirmed date without invented fixed evening hours. SEQ 1–7 must explain low/high endpoints and remain optional; after answering, retain visible selected value + thanks. No promise of email without confirmed integration capability. |

### 7.21 Tracking dialog

**Implementation:** existing `components/public/TrackDialog.tsx/.module.css`.

Use PageHeader/Field/Button inside a panel-radius modal, max `--layout-status-max`, 16px mobile/24px desktop padding, overlay token, shadow-2. Title→hint 8px, hint→field 24px, field→actions 24px. CMP0 governs controls; no selected container. Focus immediately inside the dialog, trap only enabled focusable content, inert background, Escape closes (busy handling must still provide a clear exit), restore trigger focus on close. Use one close button and one primary submit. Default, busy, invalid code and lookup failure are explicit localized states. Remove decorative ribbon circles, duplicate ornament and delayed focus tied to animation. Never lose the error when reopening or announce it twice.

## 8. Motion

| Required token | Exact value | Permitted use |
|---|---|---|
| `--dur-press` | `100ms` | Press feedback |
| `--dur-change` | `200ms` | Colour layers, visual price count, progress rail, changed-row fade |
| `--dur-enter` | `300ms` | New item/photo/section entrance |
| `--dur-exit` | `200ms` | Exit |
| `--dur-flip` | `450ms` | Ornament flip only |
| `--dur-reduced` | `0ms` | Default reduced-motion override |
| `--dur-reduced-fade` | `150ms` | Optional reduced-motion opacity only |
| `--ease-enter` | `cubic-bezier(.05,.7,.1,1)` | Enter/change |
| `--ease-exit` | `cubic-bezier(.3,0,.8,.15)` | Exit |
| `--ease-press` | `cubic-bezier(.2,0,0,1)` | Press |
| `--motion-shift` | `8px` | Maximum section/item entrance displacement |
| `--motion-press-scale` | `0.97` | Press scale |
| `--dur-pet-cycle` | `10s` | Illustration alternation interval; not transition duration |

**M1:** UI motion must animate only transform/opacity. Crossfade layers for colour; no animated background/border/filter/clip-path, shadows or layout dimensions. State colours may change immediately. Price may update text via animation but must expose final value immediately and reserve width. No UI interaction over 450ms. No automatic vibration, bouncing stepper, looping glint, decorative splatter or idle sway in forms.

**M2:** `prefers-reduced-motion:reduce` overrides CSS **and JS timers/count-up**: instant state, no rotation/slide/scale/sway/parallax; optional opacity fade ≤150ms. Do not wait for transition-end to restore interaction. Static portrait remains visible. A global reduced-motion rule must win over local styles; verify computed state, not just the presence of a media query.

**M3:** preserve the home scene's approved flat composition; scene loops may use their existing slow timing initially but require a persistent accessible pause control if motion continues beyond five seconds. Pausing/reduced motion must leave a coherent still scene. Task backdrops are static/calm. Intro may be skipped immediately, must not impose a minimum wait on ready content, and must not leave invisible focusable UI under a blocking curtain. Track must show resolved information without a forced 1500ms wipe. Decorative snow/lights do not represent task progress.

## 9. Iconography and illustration

**I1:** use simple flat SVG icons, 24px standard or 16px inline, `currentColor`, 2-unit stroke in a 24-unit viewBox, rounded line ends. Add exact token `--icon-stroke:2` for SVG stroke width. Use the same check, plus, close, calendar, help and warning shapes throughout. Native checkbox/radio rendering is permitted with the selected accent and clear labels. Emoji and arbitrary Unicode stars must not replace action/status icons.

**I2:** pets use `PetFaces`, ornaments use the shared preview renderer, scene figures use `FlatFolk`/`FlatTown`; no new unrelated realism, gradients behind labels or floating blobs. Meaningful graphics have a localized name; decorative artwork is `aria-hidden`, not separately focusable. SVG IDs must be unique per instance.

**I3:** no decorative dots/circles without meaning. Permitted circles have a concrete object/role: ornament, swatch, face/eye, snow in the home scene, lamp physically attached to a garland, calendar target, numbered progress marker. Remove free-floating card dots, status blink dots, matte “texture” dots, decorative ribbon circles and success sparkles/splatter. Loading indicators must describe actual loading and have text; arbitrary coloured bouncing balls must not block a ready screen. Keep scene geometry visually grounded on its shared baseline.

## 10. Voice and tone

**V1:** German uses friendly lowercase **du/dein**, standard German nouns and warm direct language; English uses **you/your**, British spelling (“colour”, “personalised”). Write one concrete instruction per sentence. Prefer hints of ≤12 words, but retain necessary meaning and accessible constraints. Never shorten approved legal content to fit a design.

| Content | Required rule | DE example | EN equivalent |
|---|---|---|---|
| Heading | Name the task/outcome; no sales pressure | Deine Kugel | Your ornament |
| Field label | Noun, persistent; optional marker here | Notiz für Gaby (optional) | Note for Gaby (optional) |
| Hint | Explain needed input, not repeat label | 1–6 Fotos, hell und scharf. | 1–6 photos, bright and sharp. |
| Error | What happened + concrete correction | Dieser Liefertag ist nicht mehr verfügbar. Wähle einen anderen. | This delivery day is no longer available. Choose another. |
| Required error | Name missing thing + action | Füge mindestens ein Foto hinzu. | Add at least one photo. |
| Action | Verb first, describes result | Foto hinzufügen; Liefertag wählen | Add photo; Choose delivery day |
| Change link | Always name target, even visibly | Farbe ändern · Kugel 2 | Change colour · Ornament 2 |
| Help label | Explain topic, not just “?” | Lieferung in Wien erklären | Explain Vienna delivery |
| Dates compact | Localized weekday + day + short month + evening | Mi, 2. Dez · abends | Wed, 2 Dec · evening |
| Dates full | Use full month; include year in accessible/review context | Mittwoch, 2. Dezember 2026 · abends | Wednesday, 2 December 2026 · evening |
| Prices | Currency first; decimal comma DE, point EN; exactly 2 decimals | € 12,99 | €12.99 |
| Zero delivery fee | Only if API fee is zero | Gratis | Free |
| Pending | Describe uncertainty once | Zahlung wird bestätigt… | Confirming your payment… |

**V2 · Formatting:** currency uses EUR with explicit formatting: DE currency symbol + non-breaking space + localized `de-AT` numeric value (`€ 12,99`); EN symbol directly before localized `en-IE` numeric value (`€12.99`). Use one shared formatter, including receipts and QR form. Dates are local calendar dates, parsed without UTC day shifts, not browser-default strings. Compact dates use `abends`/`evening`; no fixed-hour range. A separate (?) explanation says no fixed delivery time once.

**V3 · No repetition:** never repeat the same sentence on a screen, including accessible-only duplicates that are announced together. Show the preview disclaimer once in the live configurator, not in every review miniature. Show “Delivery in Vienna” once beside date selection with (?) help for postcode range and exceptions; address labels and selected date can confirm the answer without restating the constraint. Payment pending heading and live status must not say the same sentence twice. Distinguish a data value (date/total) repeated for review from repeated explanatory prose.

**V4 · Policy/truth:** retain approved legal content and the agreed payment button; legal adviser approval remains pending where project docs say so. Do not draft terms, withdrawal exclusions, privacy consent or email-delivery claims from this design system. Place approved required policy once at review, linked to the existing legal page. Back-name surcharge is €12.99 from API and its non-refund condition must be explained at the choice and review context; unticking before purchase recalculates the draft and is not a charge. Do not claim a charge was absent solely because a cancellation query parameter exists; reconcile the server/payment state first.

### Glossary

| Concept | German | English | Use |
|---|---|---|---|
| Product | Kugel | Ornament | Never switch to “ball”/“bauble” in customer UI |
| Custom product | Personalisierte Tierkugel | Personalised pet ornament | Product description |
| Front | Vorderseite; control: Vorne | Front | Portrait side |
| Back | Rückseite; control: Hinten | Back | Name side |
| Back name | Name auf der Rückseite | Name on the back | Paid option/field |
| Colour | Farbe | Colour | Rot/Red, Grün/Green, Beige/Beige |
| Finish | Oberfläche | Finish | Glänzend/Shiny, Matt/Matte |
| Pet | Dein Tier | Your pet | Prefer inclusive Tier, not dog-only copy |
| Reference photo | Referenzfoto | Reference photo | Uploaded source, not predicted painting |
| Delivery | Lieferung | Delivery | Vienna courier/drop-off |
| Delivery day | Liefertag | Delivery day | Calendar/date choice |
| Pickup | Abholung | Pickup | Market collection, never delivery |
| Order | Bestellung | Order | Whole purchase, may contain multiple ornaments |
| Order code | Bestellcode | Order code | Tracking identifier, not form token |
| Cart | Warenkorb | Cart | Price/product summary |
| Total | Gesamt | Total | Final amount |
| Change | … ändern | Change … | Include target; natural German verb order is allowed |
| Waiting list | Warteliste | Waitlist | Email signup + confirmation |
| Address line 2 | Stiege, Stock, Tür (optional) | Staircase, floor, apartment (optional) | Visible optional apartment details |
| Review | Prüfen & bezahlen | Review & pay | Shop; QR form uses Angaben prüfen / Review details |
| Saved details | Angaben gespeichert | Details saved | QR form completion; not payment success |

## 11. Accessibility acceptance checklist

**A1:** target WCAG 2.2 AA and the additional AWG 44px target/reduced-motion rules. Reference the [W3C standard](https://www.w3.org/TR/WCAG22/); this checklist does not itself certify compliance. AA target-size minimum is 24px with exceptions; **AWG requires 44px**. Interaction-animation reduction is an additional product requirement, not an AA claim.

- [ ] Text contrast ≥4.5:1; meaningful UI/state boundaries ≥3:1. Colour never carries selection/error/status alone.
- [ ] All controls work with keyboard; visible, unclipped focus; no focus obscured by sticky regions. All standalone targets ≥44×44px without overlap.
- [ ] One main landmark, meaningful page title, logical headings and DOM order. Each route/step/substep announces context by heading focus.
- [ ] Persistent labels, appropriate autocomplete/type/inputmode, fieldset/legend for groups; merge `aria-describedby` hint/error IDs; accurate invalid/checked/busy state.
- [ ] Errors name the field and correction; focus a linked summary after failed submission; preserve inputs. Status updates announce once.
- [ ] Native radios or complete [APG radio behaviour](https://www.w3.org/WAI/ARIA/apg/patterns/radio/); item tabs implement [APG tab behaviour](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). No conflicting ARIA states.
- [ ] Dialogs manage focus/background/escape/restore; help works by tap, keyboard and Escape.
- [ ] Reflow at 320 CSS px and 200% text zoom; test 400% browser zoom where relevant, long DE copy and text-spacing overrides. No loss of content/actions.
- [ ] Reduced-motion CSS and JS verified; pause continuing decorative motion. Meaningful SVG/alt labels, hidden decorative art, unique SVG IDs.
- [ ] No repeated data entry when existing answers can be reused; back/edit/locale changes preserve answers. Authentication or token errors offer understandable recovery.

## 12. How to apply this system

### 12.1 Required finishing checklist for every public UI change

1. Read this document and the relevant audit rows. Identify the component contract and state variants before styling. Preserve concurrent work.
2. Use tokens only. Add a missing token with an exact value to this document and `tokens.css` before using it; do not create private module aliases or raw values. Apply migration aliases cautiously.
3. Use the mandatory spacing table and a single gap owner. Inspect boundaries between components, not just each component in isolation: tabs/add, label/hint/control/error, preview/controls, review sub-lines, sticky bars.
4. Check the full typography tuple, sentence case, glossary, date/currency formatter, specific edit links and repeated copy in both languages.
5. Build every applicable CMP0 state; check loading, empty, expired, sold-out, error, disabled, busy, selected, focus and reduced motion. Do not report a design complete from source alone.
6. Verify at **360×640, 768×1024 and 1280×800**, plus 320px/reflow, long text, 200% text zoom, keyboard and touch. Inspect focus under sticky content with the virtual keyboard open. Compare component geometry and reviewed screenshots, not just pixel baselines accepted automatically.
7. Run project build/lint and the relevant Playwright flows and axe checks using `docs/ux-validation.md`; cover DE/EN, several ornaments, direct edit/return, upload partial failure/reload, unavailable date/stock, confirmation/pending/cancel/error and `/form`. Axe does not replace keyboard, contrast-on-scene or screen-reader checks. Respect the owner's execution boundary: if browser tests must run externally, hand them off and explicitly mark them **unverified** until evidence returns.
8. Review the diff: no unintended application/theme/legal changes, no secrets/PII in telemetry, no invented email success. Update the affected audit row only with verified evidence; leave unresolved rows open.

### 12.2 QR customer form reuse

`/form/:token` must use the same PublicPage/PageHeader, Field/FieldGroup, PhotoTiles, OrnamentPreview static variant, ReviewCard/rows, Price, ProgressSteps, ErrorSummary, StickyActions, Loading and PublicState as `/buy`. Extract shared pieces from current implementations; do not import a page's `BuyPage.module.css` as the permanent component library.

Keep route-specific orchestration and authority: QR form edits already purchased data, may contain multiple/finished ornaments and fixed market pickup/delivery, and never initiates payment or changes locked product choices. Show server-provided fixed facts truthfully, including legacy colours. Reuse styling and interaction semantics, not shop-only business logic. Text fields restore consistently; photos needing re-entry get the same one contextual warning. Use identical postcode/fixed-city presentation when Vienna delivery applies; do not offer editing outside the allowed domain. QR completion says details saved, with code/copy/Track; it does not say paid.

### 12.3 Proposed dev-only living style guide: `/dev/design`

**Next-agent implementation proposal, not built in Task 6:** create a development-only route guarded by `import.meta.env.DEV` and excluded from production route registration/bundle imports. It must not fetch real customers, initiate payments or send notifications/metrics. Use synthetic, non-sensitive fixtures.

| Section | Must render |
|---|---|
| Tokens | UI role swatches with token name/value and approved foreground/background contrast; ornament + portrait tints; full type scale, spacing/radius/border/elevation rulers |
| Component matrix | Every §7 component in default, hover demo, focus-visible, pressed demo, selected, disabled, error and busy states where applicable; static components explicitly marked N/A |
| Compositions | Tabs + add + editor; field groups/postcode-city; dates/cards synchronized with always-visible summary; aligned review/name surcharge/edit links; sticky bar with long pay label; QR read-only order facts |
| Languages/data | DE/EN switch, long labels/names, 1/2/max ornaments, 0/1/6 photos, unavailable variants, no dates, failed upload, expired token, payment pending/confirmed |
| Accessibility/motion | Keyboard tab order, focus ring on green/white/scrim, reduced-motion simulation plus real media preference, pause scene control, 360/768/1280 layouts and text-zoom fixture |
| Validation | Axe on component/composition states, Playwright keyboard/selection/formatting tests, reviewed screenshots; no automatic acceptance of new snapshots |

Keep the guide rendered from the actual production components/tokens, not visually similar copies. Link a rule and implementation path next to each fixture so future agents can find the source.

## 13. Exact illustration palette migration registry

This appendix completes the old-literal → centralized-token mapping for existing public artwork. It does **not** add UI semantic colours or endorse obsolete decorations. Remove a disallowed decoration/control style instead of preserving it through an art token. Keep skin, fur, buildings and snow truthful; do not replace all colours with a single brand colour.

For each row, the literal is the token's exact value. A listed existing scene/ornament/surface token is reused; otherwise add the listed `--art-hex-*` token to `tokens.css`. Short hex forms normalize to the same six/eight-digit colour (for example `#fff9` → `#ffffff99`). Black/white in artwork may use these tokens; text/control use still follows semantic roles. New artwork colours require a new exact registry entry, not an ad-hoc module literal.

| Old literal / exact value | Reuse or add token | Old literal / exact value | Reuse or add token |
|---|---|---|---|
| `#00000022` | `--art-hex-00000022` | `#1a4237` | `--art-hex-1a4237` |
| `#1f7a4d` | `--art-hex-1f7a4d` | `#1f8a55` | `--art-hex-1f8a55` |
| `#1f9a5a` | `--art-hex-1f9a5a` | `#2a1a10` | `--art-hex-2a1a10` |
| `#2a1f2d` | `--art-hex-2a1f2d` | `#2b2b33` | `--art-hex-2b2b33` |
| `#2b6d5c` | `--art-hex-2b6d5c` | `#2c3d6b` | `--art-hex-2c3d6b` |
| `#2c4fa3` | `--art-hex-2c4fa3` | `#2f5cc0` | `--art-hex-2f5cc0` |
| `#2f6b3f` | `--ornament-green` | `#2f6fd6` | `--art-hex-2f6fd6` |
| `#2f7f86` | `--art-hex-2f7f86` | `#2f9fae` | `--art-hex-2f9fae` |
| `#2fae6a` | `--art-hex-2fae6a` | `#2fb36a` | `--art-hex-2fb36a` |
| `#36844f` | `--art-hex-36844f` | `#3a5a96` | `--art-hex-3a5a96` |
| `#3b2a22` | `--art-hex-3b2a22` | `#3c2213` | `--art-hex-3c2213` |
| `#3cc46a` | `--art-hex-3cc46a` | `#3d7fe0` | `--art-hex-3d7fe0` |
| `#3d8a4a` | `--wreath` | `#3e2414` | `--art-hex-3e2414` |
| `#3f6fd8` | `--art-hex-3f6fd8` | `#3fb5c4` | `--art-hex-3fb5c4` |
| `#4a2a14` | `--art-hex-4a2a14` | `#4a7ab5` | `--gift-blue` |
| `#4aa3a8` | `--art-hex-4aa3a8` | `#4f8fe8` | `--art-hex-4f8fe8` |
| `#58361c` | `--art-hex-58361c` | `#5a3a2a` | `--art-hex-5a3a2a` |
| `#5a3fb0` | `--art-hex-5a3fb0` | `#5b3a22` | `--art-hex-5b3a22` |
| `#5b7fd6` | `--art-hex-5b7fd6` | `#5b9cf0` | `--art-hex-5b9cf0` |
| `#5f9fe8` | `--art-hex-5f9fe8` | `#62483a` | `--art-hex-62483a` |
| `#659780` | `--art-hex-659780` | `#6b4423` | `--art-hex-6b4423` |
| `#6e3813` | `--art-hex-6e3813` | `#6e3c1c` | `--art-hex-6e3c1c` |
| `#6f8fd0` | `--art-hex-6f8fd0` | `#6fd0d8` | `--art-hex-6fd0d8` |
| `#70513e` | `--art-hex-70513e` | `#71391a` | `--art-hex-71391a` |
| `#725039` | `--art-hex-725039` | `#7a4a23` | `--art-hex-7a4a23` |
| `#7a4a2c` | `--art-hex-7a4a2c` | `#7a879a` | `--art-hex-7a879a` |
| `#7aa6e0` | `--art-hex-7aa6e0` | `#7b5cd6` | `--art-hex-7b5cd6` |
| `#7cae98` | `--art-hex-7cae98` | `#7d4419` | `--art-hex-7d4419` |
| `#7e4a20` | `--art-hex-7e4a20` | `#7f8f92` | `--art-hex-7f8f92` |
| `#7fa7de` | `--art-hex-7fa7de` | `#7fb4ee` | `--art-hex-7fb4ee` |
| `#86afc7` | `--art-hex-86afc7` | `#8a4f2a` | `--art-hex-8a4f2a` |
| `#8b4a22` | `--wood-dark` | `#8b5a2b` | `--art-hex-8b5a2b` |
| `#8b929a` | `--art-hex-8b929a` | `#8d4c1b` | `--art-hex-8d4c1b` |
| `#8d5a3b` | `--art-hex-8d5a3b` | `#8f5b32` | `--art-hex-8f5b32` |
| `#8fb3e6` | `--art-hex-8fb3e6` | `#916448` | `--art-hex-916448` |
| `#94734f` | `--art-hex-94734f` | `#956548` | `--art-hex-956548` |
| `#9a581f` | `--art-hex-9a581f` | `#9a6236` | `--art-hex-9a6236` |
| `#9cc8f5` | `--art-hex-9cc8f5` | `#9cd9e9` | `--art-hex-9cd9e9` |
| `#9fb3cf` | `--art-hex-9fb3cf` | `#9fdde3` | `--art-hex-9fdde3` |
| `#a1663a` | `--art-hex-a1663a` | `#a3adb0` | `--art-hex-a3adb0` |
| `#a45f27` | `--art-hex-a45f27` | `#a5291f` | `--art-hex-a5291f` |
| `#a5c7ac` | `--art-hex-a5c7ac` | `#a85f2c` | `--art-hex-a85f2c` |
| `#a8601f` | `--art-hex-a8601f` | `#a8754b` | `--art-hex-a8754b` |
| `#a8e0a2` | `--art-hex-a8e0a2` | `#a98948` | `--ornament-hook` |
| `#a9c9f2` | `--art-hex-a9c9f2` | `#b03a2e` | `--ornament-red` |
| `#b06a3c` | `--art-hex-b06a3c` | `#b3c4dc` | `--art-hex-b3c4dc` |
| `#b52f27` | `--art-hex-b52f27` | `#b68d66` | `--art-hex-b68d66` |
| `#b6ecca` | `--art-hex-b6ecca` | `#b6f0ce` | `--art-hex-b6f0ce` |
| `#b82d36` | `--art-hex-b82d36` | `#b86f30` | `--art-hex-b86f30` |
| `#b87539` | `--art-hex-b87539` | `#b89a56` | `--art-hex-b89a56` |
| `#b9c3cd` | `--art-hex-b9c3cd` | `#b9cde8` | `--art-hex-b9cde8` |
| `#bca980` | `--art-hex-bca980` | `#be3039` | `--art-hex-be3039` |
| `#bfe7b0` | `--art-hex-bfe7b0` | `#c08553` | `--art-hex-c08553` |
| `#c0c6cc` | `--art-hex-c0c6cc` | `#c39a70` | `--art-hex-c39a70` |
| `#c3a16b` | `--art-hex-c3a16b` | `#c3cee2` | `--art-hex-c3cee2` |
| `#c3ddf6` | `--art-hex-c3ddf6` | `#c45c4a` | `--cta` |
| `#c47a3a` | `--wood` | `#c4ae8d` | `--art-hex-c4ae8d` |
| `#c5a479` | `--art-hex-c5a479` | `#c7a57f` | `--art-hex-c7a57f` |
| `#c7a66b` | `--art-hex-c7a66b` | `#c8652a` | `--art-hex-c8652a` |
| `#c9d2dd` | `--art-hex-c9d2dd` | `#c9daef` | `--art-hex-c9daef` |
| `#c9eef0` | `--art-hex-c9eef0` | `#cb9180` | `--art-hex-cb9180` |
| `#cf9964` | `--art-hex-cf9964` | `#cfe0f2` | `--art-hex-cfe0f2` |
| `#cfe0fb` | `--art-hex-cfe0fb` | `#d2b66f` | `--ornament-cap` |
| `#d2dae2` | `--art-hex-d2dae2` | `#d5e0ef` | `--art-hex-d5e0ef` |
| `#d6eef8` | `--art-hex-d6eef8` | `#d7e6ec` | `--art-hex-d7e6ec` |
| `#d8bd98` | `--art-hex-d8bd98` | `#d8c3a0` | `--ornament-beige` |
| `#d8e0e6` | `--art-hex-d8e0e6` | `#d8f1f1` | `--art-hex-d8f1f1` |
| `#d98c89` | `--art-hex-d98c89` | `#d9a074` | `--art-hex-d9a074` |
| `#d9ac78` | `--art-hex-d9ac78` | `#d9e6ef` | `--art-hex-d9e6ef` |
| `#d9e7cd` | `--art-hex-d9e7cd` | `#d9eef7` | `--art-hex-d9eef7` |
| `#d9f7e4` | `--art-hex-d9f7e4` | `#dbe6f5` | `--art-hex-dbe6f5` |
| `#dce5e7` | `--art-hex-dce5e7` | `#dde8f6` | `--art-hex-dde8f6` |
| `#df9894` | `--art-hex-df9894` | `#dfb46e` | `--art-hex-dfb46e` |
| `#dfbd78` | `--art-hex-dfbd78` | `#dfc38b` | `--art-hex-dfc38b` |
| `#e0473f` | `--berry` | `#e08a78` | `--art-hex-e08a78` |
| `#e0a83c` | `--gold-deep` | `#e1e5df` | `--art-hex-e1e5df` |
| `#e2a964` | `--art-hex-e2a964` | `#e3a25c` | `--art-hex-e3a25c` |
| `#e5b64d` | `--art-hex-e5b64d` | `#e6d4b6` | `--art-hex-e6d4b6` |
| `#e6eefb` | `--art-hex-e6eefb` | `#e8453c` | `--art-hex-e8453c` |
| `#e8846f` | `--art-hex-e8846f` | `#e8d36a` | `--art-hex-e8d36a` |
| `#e9edf3` | `--art-hex-e9edf3` | `#e9f0f9` | `--art-hex-e9f0f9` |
| `#e9f4fb` | `--art-hex-e9f4fb` | `#e9f7fc` | `--art-hex-e9f7fc` |
| `#eab1a0` | `--art-hex-eab1a0` | `#ead4b4` | `--art-hex-ead4b4` |
| `#eaf4ff` | `--art-hex-eaf4ff` | `#eafff2` | `--art-hex-eafff2` |
| `#eef3fb` | `--art-hex-eef3fb` | `#ef5d54` | `--art-hex-ef5d54` |
| `#f08a3c` | `--art-hex-f08a3c` | `#f0c46a` | `--art-hex-f0c46a` |
| `#f0c98f` | `--art-hex-f0c98f` | `#f0dcc0` | `--art-hex-f0dcc0` |
| `#f1d9a0` | `--art-hex-f1d9a0` | `#f2b3a8` | `--art-hex-f2b3a8` |
| `#f2c39c` | `--art-hex-f2c39c` | `#f2f8ff` | `--snow-field` |
| `#f2f9fd` | `--art-hex-f2f9fd` | `#f3e6a6` | `--art-hex-f3e6a6` |
| `#f4c8a9` | `--art-hex-f4c8a9` | `#f4c9a4` | `--art-hex-f4c9a4` |
| `#f4f8fb` | `--art-hex-f4f8fb` | `#f5d68a` | `--art-hex-f5d68a` |
| `#f6a04d` | `--art-hex-f6a04d` | `#f6e4b9` | `--art-hex-f6e4b9` |
| `#f6f9ff` | `--art-hex-f6f9ff` | `#f7fbff` | `--art-hex-f7fbff` |
| `#f8e9d1` | `--art-hex-f8e9d1` | `#fbe58c` | `--art-hex-fbe58c` |
| `#fbe9b7` | `--art-hex-fbe9b7` | `#fbfdff` | `--art-hex-fbfdff` |
| `#fdfeff` | `--art-hex-fdfeff` | `#ff8d82` | `--art-hex-ff8d82` |
| `#ffb9b3` | `--art-hex-ffb9b3` | `#ffc878` | `--art-hex-ffc878` |
| `#ffd166` | `--gold` | `#ffe3a0` | `--art-hex-ffe3a0` |
| `#fff3c4` | `--art-hex-fff3c4` | `#fff3cf` | `--art-hex-fff3cf` |
| `#fff3d0` | `--art-hex-fff3d0` | `#fff4df` | `--art-hex-fff4df` |
| `#fff5e4` | `--art-hex-fff5e4` | `#fff6c8` | `--art-hex-fff6c8` |
| `#fff6e2` | `--art-hex-fff6e2` | `#fff7e9` | `--art-hex-fff7e9` |
| `#fff8e6` | `--art-hex-fff8e6` | `#fffaf0` | `--art-hex-fffaf0` |
| `#fffbf2` | `--art-hex-fffbf2` | `#ffffff` | `--color-surface-raised` |

Translucent illustration colours have the following exact migration names. They are not permission to add translucent text panels, new UI shadows or a third elevation. If a value belongs to a removed shadow/decoration, remove the consumer rather than add a token.

| Exact value | Token to add if retained for artwork |
|---|---|
| `rgba(0,0,0,0.18)` | `--art-rgba-0-0-0-0p18` |
| `rgba(6,38,25,0.45)` | `--art-rgba-6-38-25-0p45` |
| `rgba(6,38,25,0.5)` | `--art-rgba-6-38-25-0p5` |
| `rgba(8,16,34,0.42)` | `--art-rgba-8-16-34-0p42` |
| `rgba(8,16,34,0.5)` | `--art-rgba-8-16-34-0p5` |
| `rgba(8,48,32,0.45)` | `--art-rgba-8-48-32-0p45` |
| `rgba(10,16,28,0.35)` | `--art-rgba-10-16-28-0p35` |
| `rgba(10,18,36,0.62)` | `--art-rgba-10-18-36-0p62` |
| `rgba(12,52,28,0.35)` | `--art-rgba-12-52-28-0p35` |
| `rgba(14,58,120,0.66)` | `--art-rgba-14-58-120-0p66` |
| `rgba(17,74,140,0.4)` | `--art-rgba-17-74-140-0p4` |
| `rgba(17,74,140,0.5)` | `--art-rgba-17-74-140-0p5` |
| `rgba(20,34,60,0.22)` | `--art-rgba-20-34-60-0p22` |
| `rgba(21,32,51,0.06)` | `--art-rgba-21-32-51-0p06` |
| `rgba(21,32,51,0.12)` | `--art-rgba-21-32-51-0p12` |
| `rgba(65,49,35,0.14)` | `--art-rgba-65-49-35-0p14` |
| `rgba(65,49,35,0.18)` | `--art-rgba-65-49-35-0p18` |
| `rgba(70,140,210,0.18)` | `--art-rgba-70-140-210-0p18` |
| `rgba(88,104,126,0.26)` | `--art-rgba-88-104-126-0p26` |
| `rgba(224,71,63,0.3)` | `--art-rgba-224-71-63-0p3` |
| `rgba(255,209,102,0.22)` | `--art-rgba-255-209-102-0p22` |
| `rgba(255,209,102,0.34)` | `--art-rgba-255-209-102-0p34` |
| `rgba(255,209,102,0.7)` | `--art-rgba-255-209-102-0p7` |
| `rgba(255,209,102,0.95)` | `--art-rgba-255-209-102-0p95` |
| `rgba(255,252,228,0.16)` | `--art-rgba-255-252-228-0p16` |
| `rgba(255,252,228,0.5)` | `--art-rgba-255-252-228-0p5` |
| `rgba(255,255,255,0.16)` | `--art-rgba-255-255-255-0p16` |
| `rgba(255,255,255,0.3)` | `--art-rgba-255-255-255-0p3` |
| `rgba(255,255,255,0.35)` | `--art-rgba-255-255-255-0p35` |
| `rgba(255,255,255,0.6)` | `--art-rgba-255-255-255-0p6` |
| `rgba(255,255,255,0.7)` | `--art-rgba-255-255-255-0p7` |
| `rgba(255,255,255,0.9)` | `--art-rgba-255-255-255-0p9` |
| `rgba(255,255,255,0.92)` | `--art-rgba-255-255-255-0p92` |
| `rgba(255,255,255,0.95)` | `--art-rgba-255-255-255-0p95` |

## 14. Short summary

Build public AWG UI with warm opaque surfaces, one dark-green selection treatment, one spacing scale and clear display/body typography. Keep the illustrated ornament central, use blue only for purchase summaries in UI, name every edit action, and share the same components with the QR form. Verify language, accessibility, states and rendered spacing before calling any implementation finished.

## Task 7B implementation notes (2026-11-05)

Public consumers must continue to follow this specification. The implemented shared components are `components/public/ItemTabs`, `ReviewCard`, `WaitlistSignup`, `components/ui/HelpTip` and the public native-radio branch of `SegmentedControl`. The existing staff branch is retained. `/dev/design` is lazy-loaded only in development, outside authentication, with synthetic fixtures and injected local actions. It is not linked from the public shell. Browser verification remains pending; see [Task 7B handoff](task7b-handoff.md).

Additional centralized rendering dimensions preserve the existing preview geometry: `--preview-perspective:800px`, `--preview-glint-shift:90px` (illustration transform only). The development gallery adds `--guide-frame-height:440px` for isolated component frames and `--guide-zoom-size:2rem` for its text-zoom fixture. These values live only in `tokens.css`; they are not new public spacing steps.

### Task 8 implementation token additions (2026-11-05)

These exact tokens support the existing globe turn and truthful read-only legacy orders. They do not add purchasable colours. Browser validation remains pending.

| Token | Exact value | Role |
|---|---|---|
| `--preview-turn-shift` | `110px` | Existing globe artwork travel, now centralized |
| `--preview-script-size` | `40px` | Existing SVG back-name script size |
| `--art-white` | `#ffffff` | Existing globe highlight, artwork only |
| `--art-black` | `#000000` | Existing globe shade, artwork only |
| `--ornament-grey` / `--portrait-grey` | `#9ca3af` / `#7b8390` | Explicit legacy grey artwork |
| `--ornament-white` / `--portrait-white` | `#f5f5f4` / `#dededb` | Explicit legacy white artwork |
| `--portrait-unknown` | `var(--color-disabled-surface)` | Neutral unrecorded order colour; never a beige selection |

The layer tokens already specified in §6 are now present in `tokens.css`. Shared `PublicPage`, `PageHeader`, `StickyActions`, `InsetNote`, `PhotoTiles`, `ContactFields`, `OptionalNote`, `OrderTimeline` and `PublicState` implementations live in `components/public/`. The shop and QR form use these production components rather than importing each other's page CSS. Fixed Vienna city text is “Wien”; the QR payload retains the existing server city value. Public field styles are scoped with `data-public-page` so staff consumers retain their styling.
