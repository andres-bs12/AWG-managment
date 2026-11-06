# UX research report: ArtWithGab `/buy`

**Recommendation:** keep the five-step wizard, but make each step more focused. Use compact product choices, a photo tile, a clearly grouped list of available delivery dates, a shorter contact form and separate review sections. The most consequential changes—stock by colour and finish, and the new delivery start date—also need backend and API changes.

This report is based on the current source code and web research. It is a design recommendation, not the result of usability testing in a browser. No files were edited.

## Priorities

| Priority | Changes |
|---|---|
| **Must** | Colour and finish with stock per combination; enforce delivery start and evening messaging; visible price and name-extra condition; photo requirement; Vienna reminder; accessible focus and errors; separate delivery from products; Stripe handoff. |
| **Should** | Centre stepper labels; improve photo tile and contact layout; group dates by month; add direct edit links on review; shorten repetitive copy. |
| **Nice** | Small name-painting illustration; optional calendar view after testing; progressive disclosure for uncommon address details. |

## Findings in the current code

- The stepper labels are left-aligned because `.progress li` and its number span are left-aligned. The heading rectangle comes from the explicit `.step h2:focus` rule.
- Colour availability is currently only `{ color, inStock }`. The draft, checkout request and server do not yet model a finish.
- The date step presents full date labels as wrapping chips. It already has loading, empty and retry states, and clears a selected date if a refreshed list no longer contains it.
- The city field is already fixed to `Wien`; adding an editable city would create unnecessary input. Postal code is validated against Vienna districts.
- Photos are held in memory and must be re-added after reload. The current helper says this on every visit; a separate message also appears after reload.
- Review currently puts the delivery day and contact details in the same enclosing review box as products. There are no direct edit links.
- The DE/EN strings live in [LocaleContext.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/i18n/LocaleContext.tsx).

## Shared wizard layout

### Stepper — **Should** · Feedback 1

Keep five equal columns. Centre each circle and its label with `text-align: center` and `margin-inline: auto` on the circle. Allow labels to wrap; shorten the last label to avoid a very tall mobile stepper.

| Step | DE | EN |
|---|---|---|
| 1 | Kugeln | Ornaments |
| 2 | Dein Tier | Your pet |
| 3 | Lieferung | Delivery |
| 4 | Kontakt | Contact |
| 5 | Übersicht | Review |

Keep the ordered list and `aria-current="step"`. Do not rely only on colour to indicate the current step. At 360 px, check both languages at 200% zoom; if labels become cramped, show `Schritt 2 von 5 · Dein Tier` / `Step 2 of 5 · Your pet` while retaining accessible progress information.

### Heading focus — **Must** · Feedback 2

Keep moving programmatic focus to the new `h2`: it tells screen-reader and keyboard users that the step changed. Replace the large black outline **on that non-interactive heading only** with a restrained focus treatment, such as a short coloured underline or accent border. Keep a strong `:focus-visible` outline on interactive controls. Test forward and back navigation with keyboard and screen reader.

The sticky mobile action bar must not cover a focused field or error. The existing scroll margins are a starting point, but test them at 360 × 640 and with text zoom. WCAG requires visible keyboard focus and, at AA, that author-created content does not entirely hide the focused component. The more specific focus-appearance criterion is AAA. [W3C: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [WCAG 2.2 changes](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

### General controls and errors — **Must**

- Aim for **44 × 44 CSS px** touch targets, including the `?`, photo remove and calendar/list controls. WCAG 2.2 AA has a **24 × 24 px minimum**, subject to exceptions; 44 px is the recommended design target here. [W3C: Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- Keep persistent labels above fields, with concrete errors beside them. Do not use placeholders as labels. [Baymard: label position](https://baymard.com/research-articles/mobile-form-usability-label-position), [GOV.UK: errors](https://design-system.service.gov.uk/components/error-message/).
- Keep the total visible, but avoid repeating a full cart and a duplicate total in the same viewport. The final review should show the complete price breakdown.

## Step 1 — Kugeln / Ornaments

### Colour and finish — **Must**

For each ornament, show two labelled radio groups:

1. **Farbe / Colour:** Rot / Red, Grün / Green, Beige / Beige.
2. **Oberfläche / Finish:** Glänzend / Shiny, Matt / Matte, with a small `?` beside the group label.

Each swatch must have a text label; colour alone is insufficient. Once a colour is chosen, show each finish’s availability for that colour. Disable and visibly mark a sold-out combination:

- **DE:** `Matt · Ausverkauft`
- **EN:** `Matte · Sold out`

If all finishes of a colour are sold out, mark the colour sold out too. If changing colour invalidates the chosen finish, clear it and ask for a new one; do not silently select another. On a stock conflict at checkout, return to that ornament with a specific message and preserve all other inputs.

The `?` should be a real button, with a 44 px touch area and an accessible name:

- **DE:** `Oberflächen erklären`
- **EN:** `Explain finishes`

On click, tap, Enter or Space, toggle a short inline explanation. Use `aria-expanded` and `aria-controls`; keep focus on the button.

- **DE:** `Glänzend reflektiert mehr Licht. Matt wirkt weicher und weniger spiegelnd.`
- **EN:** `Shiny reflects more light. Matte has a softer, less reflective look.`

These descriptions should be checked against the actual materials or photographs.

**Implementation dependency:** add colour/finish pairs and stock to the configuration, item draft, checkout contract, backend validation and inventory. Revalidate and reserve the exact combination server-side; a disabled UI option alone cannot prevent overselling. Handle older saved drafts whose grey/white colours no longer exist.

### Name on the back — **Must / Nice** · Feedback 3

Keep the price next to the checkbox and reveal the input only when selected.

- **DE:** `Name auf der Rückseite (+{price})`
- **EN:** `Name on the back (+{price})`
- **DE hint:** `Max. 6 Buchstaben, in Großbuchstaben.`
- **EN hint:** `Up to 6 letters, shown in capitals.`

**Nice:** place a decorative, approximately 48–64 px SVG beside this option: the back of a small ornament, a short sample name and a brush. Use `aria-hidden="true"` because the text already explains it. Do not let it push the checkbox or price below the fold on mobile.

**Must:** disclose the owner’s no-refund rule near the selected extra and repeat it in review. Suggested copy, subject to confirming its precise commercial and legal meaning:

- **DE:** `Wenn du den Namen später entfernen lässt, wird der Aufpreis nicht erstattet.`
- **EN:** `If you later ask us to remove the name, the extra charge is not refunded.`

Do not imply that unticking the option *before placing the order* is chargeable: the current draft simply recalculates the price. Have the final policy wording reviewed alongside the terms.

### Product summary

Retain one brief product sentence and the base price; the current product description and “includes” text repeat each other.

- **DE:** `Dein Tier, von Hand auf eine Kugel gemalt.`
- **EN:** `Your pet, hand-painted on an ornament.`

Keep each ornament’s price and the **Weitere Kugel hinzufügen / Add another ornament** control.

## Step 2 — Dein Tier / Your pet

### Photo tile — **Must / Should** · Feedback 4

Use a horizontal, wrapping row per ornament:

`[thumbnail ×] [thumbnail ×] [+ Foto hinzufügen]`

The add tile comes **after** existing thumbnails and moves right as photos are added. At six photos, keep an explanation of the limit visible; the tile may be replaced with `6/6` rather than leaving an unexplained disabled control. Use a real button connected to the file input, with both `+` and an accessible name. Each remove button needs a meaningful name such as `Foto luna.jpg entfernen` / `Remove photo luna.jpg`, a visible focus ring and a large touch area.

Suggested concise copy:

- **DE label:** `Fotos deines Tieres`
- **EN label:** `Photos of your pet`
- **DE hint:** `1–6 helle, gut erkennbare Fotos.`
- **EN hint:** `1–6 clear, well-lit photos.`
- **DE counter:** `{n} von 6 Fotos`
- **EN counter:** `{n} of 6 photos`
- **DE required error:** `Füge mindestens ein Foto hinzu.`
- **EN required error:** `Add at least one photo.`

Keep the reload limitation, but make it contextual: show it once immediately below the photo control, or as a clearly visible notice after a photo is added; show the stronger warning again after a reload when photos need replacing.

- **DE:** `Nach dem Neuladen musst du Fotos erneut hinzufügen.`
- **EN:** `If you reload, you’ll need to add your photos again.`

Tell users accepted formats and the 10 MB limit close to the picker, possibly in a short secondary line, and ensure the wording matches actual client/server acceptance. Announce count and errors politely; do not clear a required-photo error when all selected files failed. GOV.UK recommends a labelled file upload with associated instructions and errors. [GOV.UK: file upload](https://design-system.service.gov.uk/components/file-upload/).

Keep pet name and optional note in the same ornament card. Explicitly mark the note optional.

## Step 3 — Lieferung / Delivery

### List versus calendar — **Must choose a clear control** · Feedback 5

**Recommendation for approximately 15 or fewer available dates:** use a **single-column list of radio options grouped by month**, not wrapping chips. It gives each available date a predictable position, full weekday and generous touch target, without requiring users to scan many unavailable calendar cells. For example:

> **Dezember 2026**  
> ◯ Mittwoch, 2. Dezember  
> ◯ Freitag, 4. Dezember  
> ◯ Mittwoch, 9. Dezember

The exact threshold is a design heuristic, not a finding established by a comparative study. Test the list with customers. If the owner strongly prefers a calendar, prototype it against the list: clearly distinguish available, selected and unavailable days using shape/text as well as colour, and keep the selected full date visible. A calendar gives useful spatial context, but accessible grid navigation adds complexity; follow the [WAI date picker example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) if building one. [NN/g discusses calendar context](https://media.nngroup.com/media/reports/free/Tablet_Website_and_Application_UX.pdf).

Use a visible legend and compact explanatory copy:

- **DE:** `Wähle deinen Liefertag.`
- **EN:** `Choose your delivery day.`
- **DE:** `Lieferung in Wien am Mittwoch oder Freitag abends. Eine feste Uhrzeit gibt es nicht.`
- **EN:** `Delivery in Vienna on Wednesday or Friday evenings. There is no fixed delivery time.`

Show the season-end date only if useful and accurate; it should not compete with the choices.

**Delivery rule:** available dates must begin **after the first market weekend**, defined by the owner here as the last weekend of November. For 2026, if that means Saturday 28 and Sunday 29 November, the first eligible Wednesday is **2 December 2026**, subject to capacity and other market rules. Make the server authoritative and use its configured season/market dates; do not hard-code a 2026 date in the React UI. Confirm the interpretation for other years and any market exception before implementation.

Keep the existing loading, error/retry and empty states, but distinguish a temporary fetch failure from no availability. When a previously selected date becomes unavailable:

- **DE:** `Dieser Liefertag ist nicht mehr verfügbar. Bitte wähle einen anderen.`
- **EN:** `This delivery day is no longer available. Please choose another.`

## Step 4 — Kontakt / Contact

### Layout — **Should** · Feedback 6

Use one clear vertical reading order with labels above controls:

1. Name
2. E-Mail
3. Telefonnummer
4. Straße und Hausnummer
5. Stiege, Stock, Tür — optional
6. PLZ and fixed city

On desktop, place **PLZ and Stadt** in one row; the city should be a non-editable displayed value `Wien`, not an apparently editable input. A two-column layout for email and phone is possible on wide screens, but only if each remains comfortably wide. At **360 px**, keep name, email, phone and street full-width; put postal code and the short city value together only if both labels and errors fit without clipping. Otherwise stack them. Use CSS Grid with a breakpoint based on available component width.

Above the address:

- **DE:** `Lieferung derzeit nur innerhalb Wiens.`
- **EN:** `Delivery is currently available within Vienna only.`

Fields:

| DE | EN |
|---|---|
| Name | Name |
| E-Mail-Adresse | Email address |
| Telefonnummer | Phone number |
| Straße und Hausnummer | Street and house number |
| Stiege, Stock, Tür (optional) | Staircase, floor, apartment (optional) |
| PLZ | Postal code |
| Stadt: Wien | City: Vienna |

If the phone number is needed for delivery, say so briefly: **“Für Rückfragen zur Lieferung” / “For delivery questions”**. Confirm that purpose before using it. Retain `autocomplete`, email/tel input types and numeric postal keyboard. State which fields are required, and mark optional fields explicitly. Accept common phone formatting instead of forcing a particular presentation. [Baymard: checkout fields and phone](https://baymard.com/research-articles/current-state-of-checkout-ux), [GOV.UK: addresses](https://design-system.service.gov.uk/patterns/addresses/).

The Vienna postal-code rule should be checked against the actual delivery area; a postal code alone does not necessarily prove a deliverable address.

## Step 5 — Übersicht / Review

### Structure and hierarchy — **Must** · Feedback 7

Use separate sections with clear headings and spacing:

1. **Deine Kugeln / Your ornaments** — one compact card per ornament: colour + finish, pet name, photo count, name extra and its price, optional note.
2. **Lieferung / Delivery** — full date; `Abends, ohne feste Uhrzeit / Evening, no fixed time`.
3. **Kontakt und Adresse / Contact and address** — customer details and Vienna address.
4. **Preis / Price** — ornaments subtotal, delivery fee, total. Show `Gratis / Free` only when the fee is actually zero.
5. Terms, privacy link, Stripe handoff and primary action.

Place **Ändern / Change** beside each section, with an accessible name such as `Liefertag ändern / Change delivery day`. Return to review after editing, unless a change requires revalidation of subsequent answers. Preserve entered values and photos in memory. This follows the [GOV.UK check-answers pattern](https://design-system.service.gov.uk/patterns/check-answers/).

Suggested payment copy:

- **DE:** `Du wirst zur Zahlung an Stripe weitergeleitet.`
- **EN:** `You’ll be redirected to Stripe to pay.`
- **DE button:** `Weiter zu Stripe`
- **EN button:** `Continue to Stripe`

The button describes the immediate action more accurately than implying payment has already happened. Keep any required legal consent text and links accurate; do not shorten them without checking the final terms. Show the name-extra no-refund condition again when the extra is selected.

## Implementation and verification checklist

**Must before release**

- Update mock, HTTP contract, backend stock validation/reservation and staff inventory for colour + finish; handle stale drafts and stock changes.
- Enforce the delivery start, weekday and capacity rules on the server; show only returned dates. Revalidate before payment and explain conflicts.
- Verify actual Stripe test checkout, cancellation and return paths, including photo re-entry after reload. Do not promise an order or email confirmation before its actual state is known.
- Check keyboard-only navigation, screen-reader announcements, visible focus, photo errors, sold-out states and sticky-bar overlap.
- Test DE and EN at 360 px, desktop, 200% zoom and with long names, multiple ornaments, no dates, failed uploads and stale stock.

**Should after implementation**

- Run a small usability test with customers: ask them to select a finish, add photos, identify the delivery time, correct an address and explain the total before continuing to Stripe. Compare the grouped date list with a calendar prototype if the owner’s calendar preference remains strong.

