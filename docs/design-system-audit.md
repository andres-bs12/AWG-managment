# ArtWithGab public design-system audit

**Date:** 2026-11-05 · **Status:** open migration backlog · **Authority:** [Public design system](design-system.md).

This is a source audit of the current dirty checkout on `feat/backend-domain`, including uncommitted public UI changes. No app code was changed, no browser tests were run and no screenshots were accepted for Task 6. Concurrent implementation updates were reread before finalizing this audit. Line numbers are snapshot anchors; search the named selector/function if another agent moves them. Recheck each finding against the live diff before fixing it. The owner-reported tab/add spacing and review alignment were investigated in source; this document does not claim fresh visual reproduction.

**Source inventory:** 72 frontend files; combined content snapshot `0f644ce11fc0` (SHA-256 of the sorted path-to-content-hash manifest). Revalidate anchors after concurrent edits.

**Evidence:** **S** = directly observable in source or calculated geometry/contrast; **V** = source-supported visual/interaction risk requiring browser verification. **Priority:** P1 = accessibility, misleading state or flow correctness; P2 = visible consistency/readability; P3 = implementation drift/dead styling. Every entry remains **open** until implemented and verified. One systemic row may cover repeated instances; the coverage inventory records all requested files. Staff UI: **later**.

## 1. Foundations and shared controls

Paths in all finding tables are relative to `frontend/src/`.

| ID / priority / evidence | File:line and current inconsistency | Rule broken | Concrete fix |
|---|---|---|---|
| F01 · P2 · S | `styles/tokens.css:1`: no public semantic colour roles, ornament/tint tokens, full type tuples, layout sizes or motion scale; local modules recreate them. | §2.1, §2.5 token ownership | Add the exact required sets/aliases in the main document; migrate by role, retaining current spacing numbering. |
| F02 · P1 · S | `styles/tokens.css:27`: outer focus ring `#2c5aa0` is blue while local focus rings use navy and different widths. | C2, §2.3 focus | Replace with specified white separation + green outer ring; remove competing local focus recipes. |
| F03 · P2 · S | `styles/tokens.css:24`, `styles/global.css:45`: h2 is 1.25rem/650 globally, whereas Buy step h2 is 1.625rem/700; most public headings do not receive display family globally. | T1 type-role tuples | Apply display family/700 and h1/h2/h3 roles through public primitives, including legal and QR headings. |
| F04 · P2 · S | `styles/global.css:20`: body line-height 1.45 and headings 1.2/650 diverge from body 1.50 and explicit heading tuples; token scale omits label/price/caption. | §3 | Use complete type roles, not individual font-size overrides. |
| F05 · P2 · S | `styles/tokens.css:43`: panel shadow is `0 16px 40px rgba(16,24,40,.16)`; dialog, Track and sticky UI add unrelated elevations. | SH1 | Map ordinary panels to shadow-1 and dialogs/popovers to shadow-2; nested cards no shadow. |
| F06 · P1 · S | `components/ui/Button.module.css:76`: default public secondary boundary uses `--snow-2`; selected/choice and generic hover rules use `--staff-*`. | C1/C2, §7.2 | Use public semantic border/state tokens; isolate shared styling by public contract without changing unrelated consumers. |
| F07 · P2 · S | `components/ui/Button.module.css:10`: weight 650, `.lg` font 1.05rem, arbitrary rem padding and raw 120ms multi-property transitions. | T1, §7.2, M1 | Button role/600, 16/24px token padding; 100ms transform feedback, immediate colour changes. |
| F08 · P1 · S | `components/ui/Button.module.css:22`: `opacity:.45` makes unavailable labels faint; hover/active shades are unrelated raw beige values. | CMP0 disabled/pressed | Readable disabled semantic pair, no opacity multiplier; exact public hover/pressed states. |
| F09 · P2 · S | `components/ui/Button.module.css:159`, `components/ui/Button.tsx:5`: selected button/choice uses staff green, cream inset rings and blackish hover; no explicit tertiary/link variant contract. | C1, SH1, §7.2 | Map ghost to tertiary alias, add consistent link treatment, route actual selection to proper choice primitive; same green + white/check, no inset ornamentation. |
| F10 · P1 · S | `components/ui/ChoiceList.module.css:59`: card uses staff palette; selected body remains `#d4cec0`, and the selected state does not follow C1; remove the unused mark style. | C1, §7.3 | Public palette, white selected secondary text and native visible indicator/check; keep same state across card/chip/calendar. |
| F11 · P2 · S | `components/ui/ChoiceList.module.css:14`: 10px gap, 14px padding, 1.05/.95/.78rem variants and uppercase “current” styling; change target min-height 36px. | S1, T2, §7.3, A1 | 12px gap/16px card padding, role typography, sentence case, ≥44px change target. Remove unused “current” styling if unused after migration. |
| F12 · P2 · S | `components/ui/ChoiceList.tsx:25`: visible legend hidden; hard-coded English “Change {legend.toLowerCase()}” bypasses locale and can damage German noun case. | V1, §7.3 | Visible localized legend and target-specific change action; never lowercase arbitrary translated labels. |
| F13 · P1 · S | `components/ui/ChoiceList.tsx:4`: no disabled/reason/error interface; hiding unselected options in collapse mode can remove current radio focus. | CMP0, §7.3 | Support reason/error state and explicit focus restoration on collapse/expand, preserving native radio semantics. |
| F14 · P1 · S | `components/ui/SegmentedControl.tsx:24`: all buttons role=radio also expose `aria-pressed`, with no roving tabindex or arrow handlers. | §7.4, A1 | Use native radio inputs/labels; otherwise implement complete radio keyboard behaviour and only aria-checked. |
| F15 · P2 · S | `components/ui/SegmentedControl.module.css:38`: staff palette, 56px segments, 10px/12px padding, 6px content gap, 120ms colour transitions; segments wrap at 640px. | C1, §7.4, L1, M1 | Public 44px segments, 16px inline/4px group spacing, one green selection; no arbitrary wrapping for Front/Back. |
| F16 · P2 · S | `components/ui/Field.module.css:1`: field owns 24px bottom margin while form layouts also use their own spacing/negative compensation. | S1/S2, §7.5 | Remove external Field margin; FieldGroup owns 24px inter-field gap; remove compensating negative margins. |
| F17 · P2 · S | `components/ui/Field.module.css:28`: 44px controls, raw `.55rem .8rem` padding, 1.4 hint line-height, literal error/disabled colours. | §3, §7.5 | 48px minimum inputs, 12px padding, hint tuple, public semantic tokens; retain 44px hit floor. |
| F18 · P1 · S | `components/ui/Field.tsx:21`: cloning overwrites existing aria-describedby and only handles direct intrinsic children. | §7.5 association, A1 | Merge existing IDs with hint/error IDs; support composite control wiring explicitly. |
| F19 · P1 · V | `components/ui/Field.tsx:23`: each error uses role=alert; a multi-error submit can announce several at once without a summary. | §7.8, A1 | One focused error summary with field links; avoid duplicate assertive per-field announcements. Verify screen reader behaviour. |
| F20 · P2 · S | `components/ui/ProgressSteps.module.css:1`: 32px markers, green active outline and complete fill differ from Buy's private 28px navy active circles. | C1, §7.13 | One ProgressSteps variant, shared 32px markers/type/spacing and selected-green current state. |
| F21 · P1 · S | `components/ui/ProgressSteps.tsx:3`: no explicit completed-state text or step-count contract outside compact mode. | §7.13, A1 | Accessible step count/current/completed labels; preserve visible compact description; do not turn future steps into controls. |

## 2. `/buy`: spacing, selection, preview and review

| ID / priority / evidence | File:line and current inconsistency | Rule broken | Concrete fix |
|---|---|---|---|
| B01 · P2 · S | `pages/public/BuyPage.module.css:9`: 92vw/760px width and local `--select`, `--select-tint`, `--choice-line`. | §2.1, §4.3 | Shared responsive page gutter/width and semantic palette; remove local token set. |
| B02 · P2 · S | `pages/public/BuyPage.module.css:63`: private 28px progress markers; current is navy, completed green; labels shrink to .7rem at 500px. | C1, T2, L1, §7.13 | Reuse ProgressSteps with fixed role sizes; compact step-count text when needed, not tiny captions. |
| B03 · P2 · S | `pages/public/BuyPage.module.css:162`: negative bottom margin compensates for Field spacing; obsolete column rules at 751 overridden at 1031. | S1/S2, L2 | One FieldGroup gap owner; remove negative margin and superseded multi-column CSS. Current rendered email/street fields are stacked by the later override, so this is not an active two-column-form claim. |
| B04 · P2 · S | `pages/public/BuyPage.module.css:175`: three local note implementations have different borders (`--snow-2` vs muted); error colour imports staff token. | §7.7/7.8, C2 | Shared InsetNote/Alert with public tokens. |
| B05 · P2 · S | `pages/public/BuyPage.module.css:351`: selected chips use light tint + swatch ring and explicitly no check. | C1 | Keep 2px green boundary + light tint (owner decision); remove swatch ring; swatch retains product colour. |
| B06 · P1 · S | `pages/public/BuyPage.module.css:318`: 1.5px low-contrast `#b9c7d3` option border; selected boundary adds inset ring. | §2.3, SH1 | Consistent 2px control-border, selected boundary constant width, no layout-shifting/inset ring recipe. |
| B07 · P2 · S | `pages/public/BuyPage.module.css:388`: repeated raw ornament colours, cap/highlight styles separate from preview and receipt. | C3, §2.5 | Central ornament/render tokens; discard obsolete back-art CSS after consumer check. |
| B08 · P1 · V | `pages/public/BuyPage.module.css:399`: help hit area uses negative block margin; it can overlap label/chip rows while still reporting 44px. | A1, §7.6 | Allocate a real non-overlapping 44px row area, no negative target compensation; test touch bounds. |
| B09 · P1 · S | `pages/public/buy/BuyItemsStep.tsx:21`: help closes on Escape only at trigger, no outside-click handling, plain paragraph is a page-local disclosure. | §7.6 | Shared HelpPopover with complete open/close/focus contract and narrow-width inline variant. |
| B10 · P2 · S | `pages/public/BuyPage.module.css:443`: selected back-name card gets green border only, lacks the common C1 tint; nested details indent 36px. | C1, §7.3/7.5 | Same choice state as all choices; reveal Field full width below checkbox row with 16px internal separation, not arbitrary extra nesting. |
| B11 · P1 · S | `pages/public/buy/BuyItemsStep.tsx:26`: back-name input silently strips unsupported characters and slices value; QR form handles it differently. | §7.5, §12.2 | Shared name-field normalization/validation that preserves the attempted input and explains supported 1–6 letters. |
| B12 · P2 · S | `pages/public/buy/BuyPetStep.tsx:28`: photo group label is a plain paragraph; file error paragraph is not associated with the add control unless it is the validation error. | §7.12, A1 | Shared labelled PhotoTiles group; merge count/hint/read/file-error IDs, including async errors. |
| B13 · P2 · S | `pages/public/buy/BuyPetStep.tsx:43`: reading feedback and aria-busy now exist, but there is no reserved reading tile; tile layout can move when added. | §7.12/7.18 | Reserve reading placeholder tile, aria-busy, retain successful files and announce one count/status. |
| B14 · P2 · S | `pages/public/buy/BuyPetStep.tsx:43`: add-photo accessible name is only “Add photo”, without current count; async file errors have no stable association ID. | §7.12, A1 | Shared PhotoTiles name includes count/limit and merges async error IDs; retain current contextual reload warning (its basic condition already exists). |
| B15 · P1 · V | `pages/public/BuyPage.module.css:550`: remove button top/right -10px extends into neighbouring tile space. | §7.12, A1 | Place 44px target within allocated tile/toolbar area; verify no hit-area overlap or clipping. |
| B16 · P1 · S | `pages/public/buy/BuyDateStep.tsx:14`: cards are separate pressed shortcuts with blue selection, while day radios use green; summary exists only after selection and is not a live region. | C1, §7.11 | Keep shared date state (already exists), unify filled green/check treatment, always reserve summary line and polite final-date announcement. |
| B17 · P1 · S | `pages/public/BuyPage.module.css:647`: seven 44px days + six 2px gaps need 320px; Buy panel at 360px uses 92vw minus 40px inline panel padding ≈291px. Grid children can overflow tracks. | L4, §7.11 | Calendar in full 328px page region, no nested padding, no narrow inline gap; use date list when seven targets cannot fit. Verify at 360px/320px/zoom. |
| B18 · P1 · S | `pages/public/buy/BuyDateStep.tsx:16`: selected day radio label shows only day number; selected state must follow C1; earliest card thick border competes with selection emphasis. | C1, §7.11 | Add explicit selected check, distinguish earliest by text only, retain correct long radio name and shared selection. |
| B19 · P2 · S | `pages/public/BuyPage.tsx:97`: refresh clears missing deliveryDate silently; a prior chosen date disappears without explanation. | §7.11, P6 | Preserve other answers and announce unavailable-date explanation with alternatives. |
| B20 · P2 · S | `pages/public/buy/BuyDateStep.tsx:10`, `pages/public/buy/BuyContactStep.tsx:62`: Vienna information is repeated in delivery lead and address inset; support explanations are separate bespoke blocks. | V3, §7.6/7.7 | Say Vienna delivery once beside date choice; (?) contains postcode range/no fixed time; address fields confirm data without repeating constraint. |
| B21 · P2 · S | `pages/public/BuyPage.module.css:1018`: date cards use .75rem gap, .8rem padding, snow skeletons/selection, 2px outline + 1px border; mixed local units and state recipes. | S1, SH1, §7.11/7.18 | 12px gap/padding tokens, 2px constant boundary, disabled-surface skeleton, common selection/focus. |
| B22 · P3 · S | `pages/public/buy/BuyContactStep.tsx:5`: comment still says Name/Email and Street/Staircase are parallel from 640px, contradicting latest rule and current final override. | L2, English comments must describe current contract | Rewrite comment during implementation; delete superseded column rules, keep only postcode/city pair. |
| B23 · P2 · S | `pages/public/buy/BuyContactStep.tsx:66`: street and optional address detail lack common explicit maxLength constraints; optional detail lacks matching on-blur validation pattern. | §7.5 | Shared address component with backend-aligned lengths, optional marker and validation semantics across Buy/Form/Track. |
| B24 · P2 · S | `pages/public/BuyPage.module.css:749`: postcode spans 2/6 columns but lacks the shared 8rem max-width token. | L2, §4.3 | Apply same expected-length sizing in shared address layout. |
| B25 · P2 · S | `pages/public/BuyPage.module.css:813` and `pages/public/BuyPage.module.css:834`: review uses 76px preview but surcharge indent is `calc(56px + 12px)`; main row flex centres vertically. | §7.9 review alignment | One top-aligned grid/subgrid: 76px art / content / right-aligned price; all sub-lines/actions use columns 2/3. This is the source-confirmed alignment mismatch. |
| B26 · P2 · S | `pages/public/buy/BuyReviewStep.tsx:10`: all visible change buttons say bare “Ändern”/“Change”; aria-label target alone does not meet the visible-wording rule. | V1/V3, §7.9 | Visible “Farbe ändern”, “Fotos ändern”, “Name ändern” etc., including item number for multi-item. Add separate address change action. |
| B27 · P2 · S | `pages/public/BuyPage.module.css:1028`: review links start at card left, not aligned to product details; gap 1rem differs from action-group 12px. | S1, §7.9 | Place actions in shared content column with 12px gaps. |
| B28 · P2 · S | `pages/public/buy/BuyReviewStep.tsx:12`: full interactive OrnamentPreview rendered in review and buttons/disclaimer only hidden with CSS. Its animation/timer/description still runs. | §7.9/7.16, M1 | Explicit static preview variant with no controls/timers/repeated disclaimer. |
| B29 · P2 · S | `pages/public/buy/BuyReviewStep.tsx:13`: delivery/contact content uses paragraph/br stacks rather than shared semantic label/value review rows. | §7.9, §12.2 | Shared ReviewCard rows with address/date/contact labels and aligned specific edit actions. |
| B30 · P1 · S | `pages/public/buy/BuyReviewStep.tsx:17`: terms and privacy text are bundled inside one checkbox label; the only policy prose is not a shared approved-content component. | V4, §7.5/7.9 | Preserve actual approved wording; legal-owner review before changing consent meaning. Separate notice/link presentation using existing content, without inventing policy. |
| B31 · P1 · S | `pages/public/BuyPage.tsx:161`: failed validation focuses first DOM id, no linked error summary; the new visibility-aware focus effect handles a revealed target but does not provide a linked overview of errors. | §7.8/7.13 | Focus shared summary, reveal affected item/substep, link to actual enabled control, then support correction/return. |
| B32 · P1 · S | `pages/public/BuyPage.tsx:72`: focus effect now reacts to step/substep (concurrent improvement), but the focused heading still names only the main screen; item activation and document title lack distinct task context. | §7.13, A1 | Announce the actual substep/item, update localized document title, and verify focus when adding/switching items. Do not remove the newly added substep dependency. |
| B33 · P2 · S | `pages/public/BuyPage.tsx:273`: preview total, desktop cart and mobile total coexist; mobile CSS hides cart but not preview total. | P3/P4, §7.14 | One current price surface per non-review viewport: sticky total below 1024, desktop preview/cart summary once. |
| B34 · P1 · S | `pages/public/BuyPage.module.css:954`: two sticky-bar recipes (500 and 899px) conflict on padding; later mobile rule overrides bottom safe-area padding throughout its range, hard-coded 10rem/15rem scroll clearance in both narrow/mobile rules. | L1/L4, §7.14 | One <1024 contract, measured clearance and safe-area formula across full range; test keyboard/zoom. |
| B35 · P1 · V | `pages/public/BuyPage.module.css:983`: sticky preview top 0 plus sticky bottom bar can leave little readable space; a concurrent focus-scroll handler now helps scroll controls clear, but there is no viewport/keyboard unstick logic. | L4, A1 | Observe heights/available viewport; unstick preview/actions as required to keep focused fields/errors visible. |
| B36 · P2 · S | `pages/public/BuyPage.module.css:1000`: desktop two columns start at 900px, action behaviour separately at 899px; layout only widens in design step. | L1/L3 | Shared 1024px configurator/Track breakpoint and centralized content widths. |
| B37 · P2 · S | `pages/public/BuyPage.tsx:275`: “tabs” are independent pressed buttons, active border navy; add action is rendered inside BuyItemsStep rather than same toolbar. | C1, §7.10 | ItemTabs with real tab/panel semantics and separate add action in same wrapper, 16px separation/24px to editor. |
| B38 · P2 · V | `pages/public/BuyPage.module.css:988`, `pages/public/buy/BuyItemsStep.tsx:30`: tabs use 16px outside margin, cards own 16px bottom margin, add has no explicit toolbar relationship. Spacing depends on which mobile group is hidden. | S2, §7.10 | Parent toolbar owns tab/add/editor gaps in every substep. Reproduce owner-reported “add glued to Kugel 1” in browser; source proves no enforced relationship, not a fresh screenshot result. |
| B39 · P2 · S | `pages/public/BuyPage.module.css:1014`: arbitrary 16px slide, blanket press-scale rule and 450ms changed-row movement; other transitions animate colours. | M1/CMP0 | Shared 8px/300ms entrance, control-specific press, 200ms changed-row opacity; 450ms reserved for flip. |
| B40 · P1 · S | `pages/public/BuyPage.tsx:268`, `i18n/LocaleContext.tsx:346`: cancellation query displays “nothing charged” without confirmed reconciliation outcome. | P6, V4 | Show neutral cancellation/pending state until backend reconciliation supports the charge statement. Preserve draft/reload guidance once. |
| B41 · P2 · S | `pages/public/BuyPage.tsx:284`: generic Continue everywhere does not name the next decision; secure-Stripe supporting text is local. | V1, §7.2 | Context-specific Continue labels where useful (“Liefertag wählen”); retain agreed final order label and one Stripe handoff line. |

## 3. Ornament, pricing and confirmation

| ID / priority / evidence | File:line and current inconsistency | Rule broken | Concrete fix |
|---|---|---|---|
| O01 · P2 · S | `components/public/OrnamentPreview.module.css:20`: Front/Back selected segment is navy; focus uses its own navy outline. | C1/C2, §7.4 | Reuse public SegmentedControl, green selection/check, shared dual focus ring. |
| O02 · P2 · S | `components/public/PetFaces.tsx:10`: cat disc green and dog disc blue regardless of ornament colour. | C3 | Parameterize outer disc with matching darker red/green/beige token for both pets. |
| O03 · P1 · S | `components/public/OrnamentPreview.module.css:13`: white back-name lettering for beige; no beige dark-text override in active preview. | C3, §2.3 | Dark-brown beige lettering; meaningful regular-text name in accessible description/review. |
| O04 · P2 · S | `components/public/OrnamentPreview.tsx:25`: matte texture is four arbitrary white dots. | C3, I3 | Flat matte base; remove dots. |
| O05 · P2 · S | `components/public/OrnamentPreview.module.css:4`: continuous sway and 700ms glint; no pause control for 10s pet loop. | M1–M3 | No task idle sway, one 300ms glint, pause continuing portrait motion and static review/success variants. |
| O06 · P2 · S | `components/public/OrnamentPreview.tsx:16`: no colour/finish falls back to beige/matte in image description without identifying illustrative placeholder; legacy grey/white gets no visible base circle. | C3, P6, §7.16 | Explicit unconfigured label and truthful legacy rendering; do not silently claim beige choice. |
| O07 · P2 · S | `components/public/OrnamentPreview.tsx:20`: description does not name viewed side or temporary hover-preview state; default flip timing/side is local state. | §7.16, P6 | Shared side semantics and stable committed-choice description; temporary preview never masquerades as saved choice. |
| O08 · P2 · S | `components/public/PetOrnamentMini.tsx:12`: fixed SVG clipPath id repeats across instances; no shared colour/finish interface with main preview. | I2, §7.16 | Instance-unique IDs and shared renderer/static variant. |
| O09 · P2 · S | `components/public/AnimatedPrice.tsx:18`: visual count-up 300ms, no shared duration token or explicit numeric typography; locale handling delegates to inconsistent formatter. | §7.15, M1 | 200ms token-based count, tabular role, one final announcement; retain immediate accessible final value and reduced-motion instant update (already present). |
| O10 · P2 · S | `lib/money.ts:5`, `pages/public/FormPage.tsx:168`, `components/public/OrderReceipt.tsx:9`: separate Intl currency formatting produces locale-dependent symbol placement, not the specified DE prefix contract. | V2, §7.15 | Shared formatter: DE `€ 12,99`, EN `€12.99`, two decimals everywhere. |
| O11 · P1 · S | `components/public/OrderReceipt.tsx:19`: every non-red colour labelled Grey; receipt type omits finish and CSS only renders red/grey dots. | P6, C3, §7.9/7.15 | Complete colour mapping (including truthful legacy values), finish display, shared swatch/render tokens. |
| O12 · P2 · S | `components/public/OrderReceipt.module.css:2`: section h2 uses small muted label style, prices lack tabular role and row alignment shared with Buy/Form. | T1, §7.9/7.15 | Shared review/price component semantics and role typography. |
| O13 · P1 · S | `pages/public/BuyThanksPage.tsx:52`: missing code branch still uses success title; pending branch repeats same pending sentence in h1 and status. | V3, §7.19/7.20 | Neutral missing-code recovery state; pending title once with distinct status detail. |
| O14 · P2 · S | `pages/public/BuyThanksPage.tsx:57`: success embeds full interactive preview, so Front/Back and disclaimer/motion recur. | §7.16/7.20 | Static 150px success renderer; no controls/looping preview or duplicate disclaimer. |
| O15 · P1 · S | `pages/public/BuyThanksPage.tsx:58`: timeline labels “Being painted” without production-state mapping; no current/completed semantics, just ordered text. | P6, §7.20 | Map confirmed production state; paid alone means painting upcoming. Explicit current/completed/upcoming timeline. |
| O16 · P2 · S | `pages/public/BuyThanksPage.tsx:60`: seven score buttons have no low/high endpoint labels and disappear entirely after response. | §7.20 | Optional explained 1–7 scale, selected value retained with thanks; shared selectable treatment before/after submission. |
| O17 · P2 · S | `pages/public/BuyPage.module.css:1033`: success timeline/SEQ CSS lives in Buy page module with raw rem spacing; other result pages do not share it. | §12.2, S1 | Extract shared success/status/feedback composition with standard spacing. |

## 4. QR form, Track, waitlist and legal

| ID / priority / evidence | File:line and current inconsistency | Rule broken | Concrete fix |
|---|---|---|---|
| Q01 · P2 · S | `pages/public/Panel.module.css:1`: 440px/92vw panel, margins 24/48px and padding 24/20/28px; Track, Legal, Buy and dialog have separate recipes. | §4.2/4.3, §7.17 | Shared PublicPage widths/gutters/padding variants; 16px mobile/24px desktop card padding. |
| Q02 · P2 · S | `pages/public/Panel.module.css:18`: lead margin 20px and action gap 10px; several 2px metadata gaps/negative edit-link offsets. | S1/S2, §7.9 | 24px header/content relationship, 12px action gaps, 4px metadata gap; align actions in rows, no negative margins. |
| Q03 · P2 · S | `pages/public/Panel.module.css:34`: review title 1.05rem/body font and tiny border focus with 6px radius diverge from Buy heading/focus. | T1, SH1, §7.9 | Shared h3 title, consistent row actions and dual ring. |
| Q04 · P2 · S | `pages/public/Panel.module.css:54`: colour dots cover red and fallback grey only; old red uses berry-deep rather than ornament-red. | C3 | Shared complete colour swatch mapping, including read-only legacy values. |
| Q05 · P1 · S | `pages/public/FormPage.tsx:315`: photo upload is separate camera/gallery buttons, 88px thumbnails/full text remove controls, filenames as alt; differs from Buy's 76px trailing plus tile. | §7.12, §12.2 | Reuse PhotoTiles, meaningful pet/index alt, consistent upload/count/error/reload presentation. |
| Q06 · P1 · V | `pages/public/FormPage.tsx:335`: visually hidden file inputs remain keyboard focusable without visible focus proxy. | A1, §7.12 | Visible add button triggers non-tab-stop file input and carries labels/descriptions/errors; verify picker return focus. |
| Q07 · P2 · S | `pages/public/FormPage.tsx:327`: unconditional photo reload warning and count before two separate add controls, no reserved reading placeholder. | V3, §7.12 | Same conditional one-warning pattern and reserved reading tile as Buy. |
| Q08 · P1 · S | `pages/public/FormPage.tsx:252`: no summary or focus/scroll management on failed Continue, error redirect or step change. | §7.8/7.13, A1 | Shared error summary, focus correct heading/control, localized title and safe scroll clearance. |
| Q09 · P2 · S | `pages/public/FormPage.tsx:404`: separate five-step compact progress, repeated editability paragraph above every step, variable h1 changes with no PageHeader. | §7.13/7.17, V3 | Shared progress visual grammar (count can differ), one contextual editability help, stable page/step heading hierarchy. |
| Q10 · P1 · S | `pages/public/FormPage.tsx:447`: address before contact, no grouped headings, editable city, missing address autocomplete, no shared postcode/city row. | L2, §7.5, §12.2 | Shared one-column Contact/Address groups, correct autocomplete, postcode/fixed Vienna pair only for Vienna flow. Preserve server authority. |
| Q11 · P2 · S | `pages/public/FormPage.tsx:453`: phone lacks purpose hint; field validation only on Continue; street/line2 errors are cleared inconsistently. | §7.5 | Shared on-blur/error-clearing protocol and phone purpose hint across Buy/Form/Track. |
| Q12 · P2 · S | `pages/public/FormPage.tsx:484`: back names sliced without shared uppercase/letter policy; note textarea always expanded and optional marking differs from Buy. | §7.5, V1, §12.2 | Shared BackNameField and optional-note disclosure; do not add shop purchase controls to QR form. |
| Q13 · P2 · S | `pages/public/FormPage.tsx:96`: local ReviewRow and bare visible edit text; review rows list colour but omit finish, renderer/photo size differs. | §7.9, §12.2 | Shared ReviewCard with target-specific visible action, colour+finish and aligned media/details. Fixed facts remain read-only. |
| Q14 · P2 · S | `pages/public/FormPage.tsx:619`: inline marginTop 24 outside token system; form uses div/buttons rather than shared form submit/navigation composition. | §2.1, §7.14 | Shared token-based action stack/form semantics; confirm Enter behaviour and busy aria state. |
| Q15 · P1 · S | `pages/public/FormPage.tsx:380`: non-editable branch lacks meaningful heading/structured state; load failure only Home without retry distinction. | §7.19 | PublicState variant differentiates expired, locked and retryable failure without inventing token validity. |
| R01 · P2 · S | `pages/public/TrackPage.module.css:1`: separate 460/780px cards, 20/30px padding, 860px desktop and 520px facts breakpoint. | L1/L3, §7.17 | Shared page/panel/grid tokens and 1024px illustration/detail split. |
| R02 · P2 · S | `pages/public/TrackPage.module.css:43`: status chip has blinking dot; delivered state blue; heading scale independent, facts uppercase. | C2, T2, I3 | Text + semantic status icon, no blink; delivered uses confirmed-success semantic role; normal heading/label roles. |
| R03 · P2 · S | `pages/public/TrackPage.module.css:189`: facts blue, address dashed divider, 18/14px section spacing, gradient/glowing primary. | C2, S1, SH1, §7.2 | Neutral facts, full-width solid divider with 57px section relationship, flat public primary and shared spacing. |
| R04 · P1 · S | `pages/public/TrackPage.tsx:20`: successful fetch waits 1500ms + 380ms for decorative wipe even under reduced motion; checking phase can show blank content. | P6, §7.18, M2/M3 | Immediate meaningful loading status; render resolved data without minimum animation wait; reduced-motion JS path instant. |
| R05 · P1 · S | `pages/public/TrackPage.tsx:197`: address fields lack consistent autocomplete/inputmode/length/purpose/optional wording, editable city; no Cancel editing action. | §7.5, §12.2 | Shared address group, fixed city where product requires, optional detail label, Save/Cancel action group and error summary. |
| R06 · P1 · S | `pages/public/TrackPage.tsx:149`: entire result card live region; saved-address paragraph lacks targeted status; failure repeats in page and dialog. | V3, §7.8/7.19, A1 | Small targeted status region and heading focus; announce errors once in active context. |
| R07 · P2 · S | `pages/public/TrackPage.tsx:243`: unknown/empty order illustrated as painting before status is known. | P6, §7.19 | Neutral static empty/error state until real status resolves. |
| R08 · P3 · S | `pages/public/TrackPage.module.css:90`: old custom `.steps`, `.includes`, `.items` recipes remain while TSX uses ProgressSteps/OrderReceipt. | §12.1 single source | Verify no consumers, remove obsolete parallel designs during migration; do not treat dead low-contrast labels as active rendered failures. |
| W01 · P1 · S | `pages/public/WaitlistPage.tsx:20`: nested main inside PublicLayout main; all result variants are a title + status with no meaningful recovery/next action. | A1, §7.19/7.20 | Use PublicState section, distinct confirmation/unsubscribe/pending/error content and available navigation/recovery. |
| W02 · P2 · S | `components/public/SeasonClosed.tsx:12`: native email input bypasses Field, raw spacing/inline submit recipe, different error association and no aria-busy. | §7.5/7.19 | Shared Field/actions/loading/error behaviour; no auto-success claim without integration capability. |
| W03 · P2 · S | `components/public/SeasonClosed.module.css:3`: looping flying sleigh, blue gradient inset scene and arbitrary 16px radius/.85rem prose. | M3, T1, SH1 | Static approved season illustration in calm task context, shared sizes/type; no looping distraction. |
| G01 · P2 · S | `pages/public/LegalPage.module.css:1`: translucent white panel, custom 680px calculation/32px margin/24px padding, body line-height 1.6; h2 1.25rem sans. | §2.2 opaque surfaces, §3/4, §7.17 | Shared reading-width PublicPage with h2 role, heading/content/paragraph/list spacing; retain actual legal text. |
| G02 · P2 · S | `pages/public/LegalPage.tsx:11`: notice is a bordered pill before h1; language/paragraph/list spacing depends on browser defaults/reset. | §7.7/7.17, S1 | PageHeader first, approved notice in neutral shared pattern, deliberate prose/list spacing. No legal rewriting. |
| G03 · P3 · S | `pages/public/BuyPlaceholderPage.tsx:8`: a separate placeholder composition remains, with its own copy/actions. Reachability not established from this file alone. | §7.19 | If retained/routed, reuse PublicState; check route consumers before deleting. Do not claim it is currently a visible production route. |

## 5. Public shell, home, dialogs and illustration

| ID / priority / evidence | File:line and current inconsistency | Rule broken | Concrete fix |
|---|---|---|---|
| H01 · P2 · S | `layouts/PublicLayout.tsx:20`: calm mode limited to form/track, so Buy, waitlist and legal retain hero scene motion. | §7.17, M3 | Home alone uses hero composition; transactional/reading routes use calm static background. |
| H02 · P1 · S | `layouts/PublicLayout.tsx:54`: language selected state is data-on only, without checked/pressed semantic state; translucent white selection differs from green. | C1, §7.4/7.17 | Shared accessible language SegmentedControl with green checked option. |
| H03 · P1 · V | `layouts/PublicLayout.module.css:22`, `pages/public/HomePage.module.css:33`: brand/title/light subtitle on varying sky rely on shadows. White on sky-mid is only 2.86:1 (even large text needs 3:1); small white on sky-top is 4.20:1. | §2.3, A1 | Opaque contrast backplate/dark text surface for meaningful copy; verify actual composited pixels for each viewport. These solid-stop ratios show risk, not measured rendered title failure. |
| H04 · P2 · S | `layouts/PublicLayout.module.css:22`: header 10/14px padding, 3px locale-group padding, 1.5px borders; footer has contradictory nowrap/wrap recipes and custom gaps. | S1, SH1, §7.17 | Shared header/footer gutter/padding and 2px selected-control boundaries; remove overridden recipes, retain working 44px legal/social targets. |
| H05 · P2 · S | `pages/public/HomePage.tsx:36`: Track and Buy both default primary variant; star glyph rotates beside Track. | P3, I1/I3, §7.2 | One primary Track action, secondary Buy; remove non-semantic spinning star. |
| H06 · P2 · S | `pages/public/HomePage.module.css:16`: 4/14px fluid gaps, 10/14px action gaps and multiple independent title sizes/weights; entrance 600/850ms bounce. | S1, T1, M1 | Use shared display/caption/action spacing and ≤300ms non-bouncing entrance; retain scene geometry baseline. |
| H07 · P2 · S | `components/public/Countdown.module.css:8`: uppercase/letter-spaced captions at .7/.78rem, 6px gaps and semi-transparent navy cells. | T2, S1, C2 | Sentence-case caption roles, scale gaps, opaque neutral/brand backplate (countdown is not cart context), verify text contrast. Retain daily accessible summary. |
| H08 · P1 · S | `components/public/IntroCurtain.tsx:15`: imposed 2s hold, 760ms exit; reduced motion still waits, backdrop can cover focusable home controls. | §7.18, M2/M3, A1 | Ready content never waits for decoration; immediate skip; inert/focus management if an intro is retained, token timing/reduced path. |
| H09 · P2 · S | `components/public/IntroCurtain.module.css:92`, `components/public/IntroCurtain.tsx:116`: four unrelated pastel bouncing dots imply loading even when only forced hold remains. | I3, P6 | Real loading status with text only when loading; remove decorative blocking dot sequence and extra hem animation. |
| D01 · P2 · S | `components/public/TrackDialog.tsx:106`: coloured floating ribbon circles and extra ornament are unrelated to code entry. | P1/P2, I3, §7.21 | Remove ribbon/dots; one calm code-entry dialog using shared PageHeader/Field/actions. |
| D02 · P2 · S | `components/public/TrackDialog.module.css:24`: 24px radius, 48px top padding, 26px/60px shadow, .34s bounce, ornate glossy ornament; inconsistent panel family. | SH1, §7.21, M1 | Panel radius 20px, shared padding/shadow-2 and 300ms entrance; no secondary decorative product. |
| D03 · P1 · S | `components/public/TrackDialog.tsx:36`: initial focus delayed 220ms; focusable query includes disabled elements, busy state disables close/escape. | A1, §7.21 | Immediate focus, filter enabled focusable elements, inert background and explicit usable exit behaviour during request; test focus trap. |
| D04 · P2 · V | `components/public/TrackDialog.module.css:155`: placeholder `#7a879a` can be below normal text contrast on warm surface; custom uppercase tracking/type. | §2.3, T2 | Muted-text placeholder and role typography; uppercase only actual order code, not all dialog metadata. |
| D05 · P2 · S | `components/public/OrnamentLoader.tsx:5`: status region contains empty decorative spans and no localized loading text. | §7.18, A1 | Shared loader with visible/localized status and aria-hidden art; reserve layout size. |
| I01 · P2 · S | `components/public/PaintingOrnament.module.css:71`: animated clip-path paint reveal and fill-changing brush; decorative splatter circles/glow. | M1, I3 | Transform/opacity-only layers or static illustration; remove ungrounded splatter; calm task context. |
| I02 · P2 · S | `components/public/GiftBoxReady.tsx:46`: standalone sparkle stars/circle and duplicate fixed-green pet render; differs from configured ornament. | I2/I3, C3 | Shared configured static ornament renderer inside meaningful packaging; remove floating sparkles. |
| I03 · P2 · S | `components/public/SleighWipe.module.css:17`: clip-path circle wipes, large gradients and continuous multi-part loop; global reduced CSS does not remove Track's JS wait. | M1–M3, §7.18 | Replace task-blocking wipe with immediate loading/status; if scene art retained, static or transform/opacity only with pause. |
| I04 · P2 · S | `components/public/CabinScene.module.css:151`: star animates drop-shadow filter, despite stated transform/opacity-only policy. | M1 | Static tokenized glow or opacity layer; retain grounded cabin/garland geometry. |
| I05 · P1 · S | `components/public/WinterBackdrop.module.css:46`, `components/public/VillageStreet.module.css:111`, `components/public/FlatFolk.module.css:22`, `components/public/FlatTown.module.css:10`: continuous clouds/traffic/limbs/lights have reduced-motion rules but no persistent pause control. | M3, A1 | Preserve approved scene with accessible pause mechanism; make task backdrop static. Reduced-motion support alone does not supply pause control. |
| I06 · P2 · S | `components/public/MarketStall.tsx:5`: hard-coded English image label and independent heavily shaded stall design. | V1, I2 | If reused, localized caller-supplied name or decorative semantics and approved flat scene/ornament style. Check consumers first. |
| I07 · P2 · S | `components/public/Snowfield.tsx:16`: dynamic raw sizes/durations and per-flake styles; scene allowed on task routes at low density. | §2.1, M3 | Centralize approved illustration size/timing values; Home scene only, static/calm task treatment. Keep reduced-motion positions coherent. |
| I08 · P2 · S | `components/public/FlatTown.tsx:11`, `components/public/FlatFolk.tsx:9`, `components/public/CabinScene.tsx:11`, `components/public/GiftBoxReady.tsx:14`, `components/public/SleighWipe.tsx:104`, `components/public/PaintingOrnament.tsx:21`: artwork repeats inline hex palettes; illustration modules contain numerous raw geometry lengths/timings/shadows. | §2.1/2.5, I2 | Centralize approved artwork colours with the documented exact literal→token mapping; convert CSS design dimensions/timings to tokens, retain unitless SVG geometry. Do not repaint everything green or use UI token roles for scene objects. |
| I09 · P3 · S | `components/public/FlatTown.tsx:5`, `components/public/WinterBackdrop.module.css:19`, `layouts/PublicLayout.module.css:100`: comments overstate compositor-only behaviour/footer no-wrap relative to current implementation. | §12.1 evidence | Update comments when correcting filter/paint/override issues; SVG animation can repaint even when properties are transform/opacity. |

## 6. Scope coverage and non-findings

The following complete inventory records every requested UI/public file and related public layout/style file read. It is not a claim that every SVG coordinate is a design defect. Geometry-only variants inherit palette/motion findings where listed. No new bug is inferred merely because a component exists.

| File read (relative to `frontend/src/`) | Coverage / result |
|---|---|
| `components/public/AnimatedPrice.tsx` | O09–O10 |
| `components/public/CabinScene.module.css` | I04–I05, I08 |
| `components/public/CabinScene.tsx` | I04–I05, I08 |
| `components/public/Countdown.module.css` | H07 |
| `components/public/Countdown.tsx` | H07 |
| `components/public/FlatFolk.module.css` | I05, I08 |
| `components/public/FlatFolk.tsx` | I05, I08 |
| `components/public/FlatTown.module.css` | I05, I08–I09 |
| `components/public/FlatTown.tsx` | I05, I08–I09 |
| `components/public/GiftBoxReady.module.css` | I02, I08 |
| `components/public/GiftBoxReady.tsx` | I02, I08 |
| `components/public/IntroCurtain.module.css` | H08–H09 |
| `components/public/IntroCurtain.tsx` | H08–H09 |
| `components/public/MarketStall.module.css` | I06, I08 |
| `components/public/MarketStall.tsx` | I06, I08 |
| `components/public/OrderReceipt.module.css` | O10–O12 |
| `components/public/OrderReceipt.tsx` | O10–O12 |
| `components/public/OrnamentLoader.module.css` | D05, I08 |
| `components/public/OrnamentLoader.tsx` | D05, I08 |
| `components/public/OrnamentPreview.module.css` | O01–O07, I08 |
| `components/public/OrnamentPreview.tsx` | O01–O07, I08 |
| `components/public/PaintingOrnament.module.css` | I01, I08 |
| `components/public/PaintingOrnament.tsx` | I01, I08 |
| `components/public/PetFaces.tsx` | O02, I08 |
| `components/public/PetOrnamentMini.module.css` | O08, I08 |
| `components/public/PetOrnamentMini.tsx` | O08, I08 |
| `components/public/SeasonClosed.module.css` | W02–W03 |
| `components/public/SeasonClosed.tsx` | W02–W03 |
| `components/public/SleighWipe.module.css` | I03, I08 |
| `components/public/SleighWipe.tsx` | I03, I08 |
| `components/public/Snowfield.module.css` | I07 |
| `components/public/Snowfield.tsx` | I07 |
| `components/public/TrackDialog.module.css` | D01–D04 |
| `components/public/TrackDialog.tsx` | D01–D04 |
| `components/public/VillageStreet.module.css` | I05, I08 |
| `components/public/VillageStreet.tsx` | I05, I08 |
| `components/public/WinterBackdrop.module.css` | I05, I08–I09 |
| `components/public/WinterBackdrop.tsx` | I05, I08–I09 |
| `components/ui/Button.module.css` | F06–F09 |
| `components/ui/Button.tsx` | F06–F09 |
| `components/ui/ButtonLink.tsx` | F06–F09 |
| `components/ui/ChoiceList.module.css` | F10–F13 |
| `components/ui/ChoiceList.tsx` | F10–F13 |
| `components/ui/Field.module.css` | F16–F19 |
| `components/ui/Field.tsx` | F16–F19 |
| `components/ui/ProgressSteps.module.css` | F20–F21 |
| `components/ui/ProgressSteps.tsx` | F20–F21 |
| `components/ui/SegmentedControl.module.css` | F14–F15 |
| `components/ui/SegmentedControl.tsx` | F14–F15 |
| `layouts/PublicLayout.module.css` | H01–H04; shared layout inspected for consumer context. |
| `layouts/PublicLayout.tsx` | H01–H04; shared layout inspected for consumer context. |
| `pages/public/BuyPage.module.css` | B01–B41, O17 |
| `pages/public/BuyPage.tsx` | B01–B41, O17 |
| `pages/public/BuyPlaceholderPage.tsx` | G03 |
| `pages/public/BuyThanksPage.tsx` | O13–O16 |
| `pages/public/FormPage.tsx` | Q01–Q15 |
| `pages/public/HomePage.module.css` | H03, H05–H06 |
| `pages/public/HomePage.tsx` | H03, H05–H06 |
| `pages/public/LegalPage.module.css` | G01–G02 |
| `pages/public/LegalPage.tsx` | G01–G02 |
| `pages/public/Panel.module.css` | Q01–Q04 |
| `pages/public/TrackPage.module.css` | R01–R08 |
| `pages/public/TrackPage.tsx` | R01–R08 |
| `pages/public/WaitlistPage.tsx` | W01 |
| `pages/public/buy/BuyContactStep.tsx` | B20, B22–B24 |
| `pages/public/buy/BuyDateStep.tsx` | B16–B21 |
| `pages/public/buy/BuyItemsStep.tsx` | B09–B11, B38 |
| `pages/public/buy/BuyPetStep.tsx` | B12–B14 |
| `pages/public/buy/BuyReviewStep.tsx` | B25–B30 |
| `pages/public/buy/shared.ts` | Read: shared photo limit/colour-key contracts; no independent styling inconsistency found. |
| `styles/global.css` | F01–F05; existing reduced-motion global override is present, not reported missing. |
| `styles/tokens.css` | F01–F05; existing reduced-motion global override is present, not reported missing. |

Additional context read: `AGENTS.md`, `tasks/todo.md`, `docs/sprint6-buy-ux.md` including Form design rules, `docs/plan-buy-premium.md`, and **all five** research files (`ux-claude.md`, `ux-codex.md`, `premium-claude.md`, `premium-codex.md`, `name-option-codex.md`). Supporting formatter/draft/localization sources were inspected to verify price, warning and copy findings.

Already present and intentionally preserved: server-confirmed payment polling with a 60s fallback; photos remain references rather than composited portraits; date cards/calendar already share draft date state; API stock/availability determines offered choices; current final CSS keeps ordinary contact/address fields stacked; global reduced-motion CSS disables animation/transitions; AnimatedPrice has a reduced-motion JS branch; public legal/social targets have already been increased to 44px. These are not missing-feature findings. Their remaining consistency gaps are listed above.

## 7. Implementation and verification order

| Batch | Fix scope | Required evidence before closing rows |
|---|---|---|
| 1 | Foundation aliases/roles, shared button/field/selection/focus contracts | Token/contrast checks; guide fixture comparison; keyboard and axe, both languages |
| 2 | Item toolbar, review subgrid, date picker geometry, measured sticky clearance | 360/768/1280 screenshots, two ornaments + surname/surcharge alignment, calendar at 320px/zoom, virtual keyboard/focus checks |
| 3 | Extract shared PhotoTiles/address/ReviewCard/status; migrate QR Form and Track | Same component fixtures; multi-item QR flow, legacy colours, edit/return, upload errors/reload and no unintended payment UI |
| 4 | Header/home/dialog/scene restraint, localization/formatter, confirmed-state success | Actual composited contrast, pause/reduced-motion CSS + JS, dialog focus and payment pending/timeout/cancel/confirmed checks |
| 5 | `/dev/design` proposal and regression handoff | Development-only routing, no real data/actions/telemetry, state gallery, reviewed snapshots and relevant e2e/axe results |

These rows are a migration proposal, not authorization to change legal meaning or product rules. The next implementation agent must respect the active checkout's ownership and inspect current diffs. Browser execution follows the owner's external-validation boundary in `docs/ux-validation.md`; source review, build/lint and writing tests do not close browser-dependent rows.

## Short summary

The largest consistency gaps are competing selection palettes, unowned spacing between components, mismatched review columns and separate QR-form patterns. Unify tokens and shared components first; then verify rendered spacing, truthfulness, keyboard operation and both languages. All audit findings remain open; Task 6 delivers documentation only.
