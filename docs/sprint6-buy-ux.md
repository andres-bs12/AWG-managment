# Sprint 6: owner answers and the `/buy` UX redesign (2026-11-05)

Sources:
- Owner feedback on the `/buy` screenshots.
- Two independent UX research reports, one by Claude and one by Codex, citing Baymard, NN/g, GOV.UK, WCAG 2.2 and the WKO/FAGG rules.

Backend changes by Claude (commit `48f900d`); frontend changes by Codex; each reviews the other.

## API contract changes

### Colors and finish
- `CustomColor` values are `red`, `green` and `beige`. `grey` and `white` stay valid for old orders but are no longer sold.
- New `CustomFinish` values: `shiny` and `matte`.
- Stock is tracked per color and finish.
- `ShopConfig.colors` is a list of `{ color, finish, inStock }`, ordered red, green, beige and shiny before matte. It holds one entry per offered combination.

### Shop config
- New field `ShopConfig.deliveriesFrom`: an ISO date (`2026-11-30`) or `null`. No web delivery is offered before it, because the season starts with the first market weekend (27–29 Nov).
- The server already filters the delivery dates. The UI uses this field only for copy such as "Lieferungen ab 2. Dezember".

### Shop checkout
- Each item gains a `finish` field, required for custom ornaments.
- A missing finish returns 400 `VALIDATION` with field `items[n].finish`.
- A color that is no longer sold returns 400 `VALIDATION` with field `items[n].color`.

### Staff sale
- `POST /api/orders` items gain an optional `finish`. It defaults to `shiny`.
- The UI should always send it.

### Finish in other DTOs
`finish` is added next to `color` in:
- `OrderItem`
- `AgendaDelivery`
- `TrackItem`
- `InventoryItem` (`null` for finished ornaments)

### Form link expiry
- The customer form link expires 30 days after the order is handed over.
- An expired link returns 404 with `code: FORM_EXPIRED`.
- UI message:
  - DE: "Dieser Link ist abgelaufen. Schreib uns, wenn du etwas brauchst."
  - EN: "This link has expired. Write to us if you need anything."

### Track
- For old short codes (`AWG` followed by 4 characters), the response has an empty customer name and empty pet and back names, unless the form token is sent.
- The UI already handles empty names with a generic greeting.

### Waitlist double opt-in
- `POST /api/shop/waitlist` now sends a confirmation e-mail.
- The UI text after signing up:
  - DE: "Fast geschafft: Bitte bestätige deine E-Mail über den Link, den wir dir geschickt haben."
  - EN: "Almost done: please confirm your e-mail with the link we sent you."
- The e-mail links point to `/waitlist/confirm#<token>` and `/waitlist/unsubscribe#<token>`. The token sits in the URL fragment, so it never reaches the server logs.
- New public page for both paths:
  1. Read the token from `location.hash`.
  2. Remove it from the URL with `history.replaceState`.
  3. On load, POST `{ token }` to `/api/shop/waitlist/confirm` or `/api/shop/waitlist/unsubscribe`. These return 204; confirm returns 404 when the token is unknown.
  4. Show a short DE/EN result.

### Retention
Nightly job:
- 60 days after the handover, photos and personal data are deleted. The customer name becomes `(deleted)`.
- The staff UI can show `(deleted)` as "Deleted customer" (optional).

## UX decisions (merged from both reports)

### Global
1. **Step heading focus.** Keep moving focus to the `h2` for screen readers, but remove the black outline on that non-interactive heading.
   - CSS: `.step h2:focus { outline: none }`.
   - Use `focus({ preventScroll: true })`, then scroll the stepper or panel top into view.
   - Interactive controls keep a strong `:focus-visible` outline.
2. **Stepper.**
   - Five equal columns, with the circle centered above a centered label and a thin connector line between circles.
   - Completed steps show a ✓.
   - `aria-current="step"` stays.
   - Short labels:
     - DE: Kugeln · Dein Tier · Lieferung · Kontakt · Übersicht
     - EN: Ornaments · Your pet · Delivery · Contact · Review
3. **Less text.**
   - Show the lead text under the page title only on step 1.
   - Remove "Alle Felder sind erforderlich"; mark optional fields as "(optional)" instead.
   - On mobile, don't show the total twice in the same viewport.
4. **Touch targets.** Use a 44 px hit area for every control, including the "?", photo remove and calendar days (calendar days are at least 40 px).

### Step 1: Kugeln
- **Product card.** One short sentence and the base price.
  - DE: "Dein Tier, von Hand auf eine Kugel gemalt."
  - EN: "Your pet, hand-painted on an ornament."
- **Two labelled radio groups per ornament.**
  - **Farbe / Colour:** Rot / Red, Grün / Green, Beige. Each is a swatch with its text label. Suggested swatches: red `#b03a2e`, green `#2f6b3f`, beige `#d8c3a0`.
  - **Oberfläche / Finish:** Glänzend / Shiny, Matt / Matte.
    - Small swatches: a glossy highlight for shiny, flat for matte.
    - Show availability for the selected color.
    - Disable a sold-out combination and label it "Ausverkauft" / "Sold out".
    - If a color is sold out in both finishes, mark the color as sold out.
    - If changing the color invalidates the chosen finish, clear the finish and ask again.
- **"?" button next to the Finish label.**
  - A real button with a 44 px hit area, `aria-expanded` and `aria-controls`, and the name "Oberflächen erklären" / "Explain finishes".
  - It toggles a short inline explanation; Escape closes it.
    - DE: "Glänzend: spiegelt das Licht, kräftige Farben. Matt: weich und samtig, ohne Spiegelungen."
    - EN: "Shiny: reflects the light, vivid colours. Matte: soft and velvety, no reflections."
- **Name on the back.**
  - A compact card with a checkbox: "Name auf der Rückseite (+€ 12,99)" / "Name on the back (+€ 12.99)".
  - A small (about 56 px) inline SVG of the back of an ornament with a name being painted by a brush. It is decorative (`aria-hidden`).
  - When checked, show the input (max 6 letters, in capitals) with the hint "Max. 6 Buchstaben" / "Up to 6 letters".
  - Drafts with an old color (grey or white) or no finish must be reset to an empty choice.

### Step 2: Dein Tier
- **Photos.** A wrapping row: `[thumb ×] [thumb ×] [+ tile]`.
  - The dashed "+" tile (same size as the thumbs, about 76 px) always comes after the last thumbnail, so it moves right as photos are added.
  - At 6 photos the tile disappears and "6 von 6" is shown.
  - The tile is a real button that opens the file input.
  - Hint (one line): "1–6 Fotos, hell und scharf." / "1–6 photos, bright and sharp."
  - The reload warning appears only once a photo has been added, or after a reload.
  - Alt text: "Foto 1 von Luna" / "Photo 1 of Luna".
  - Show a loading state while a photo is being read.
- **Optional note.** Collapsed behind "+ Notiz für Gaby (optional)" / "+ Note for Gaby (optional)".

### Step 3: Lieferung (owner asked for a calendar)
- **Calendar.** A month grid starting on Monday, built from native radio inputs (no new dependency).
  - Only the available dates returned by the API are selectable. They show as circles of 40 px or more.
  - Unavailable days are muted and not focusable.
  - Selected day: filled circle plus a check, so it does not rely on colour alone.
  - Show only the months that contain available dates (normally just December 2026), each with its month heading. No navigation.
  - Arrow keys move between radios through native radio-group behaviour.
- **Below the grid:**
  - A confirmation line for the selected day, e.g. "Mittwoch, 9. Dezember · abends" / "Wednesday, 9 December · evening".
  - A tiny legend: "● verfügbar" / "● available".
- **Lead copy.**
  - DE: "Wir liefern in Wien am Mittwoch oder Freitag, am Abend. Eine feste Uhrzeit gibt es nicht."
  - EN: "We deliver in Vienna on Wednesday or Friday evenings. There is no fixed time."
  - Below it, show "Lieferungen ab {deliveriesFrom formatted}" when `deliveriesFrom` is in the future.
- **24 Dec** (Thursday) is the owner's chosen last delivery day of the season. Keep it as an exception; in the calendar it is selectable like any other available date.
- Keep the loading, empty and retry states.

### Step 4: Kontakt
Two groups with small headings.
- **Kontakt / Contact:** Name, E-Mail, Telefon.
  - Phone hint: "Nur für Rückfragen zur Lieferung" / "Only for questions about the delivery".
  - E-mail and phone stay stacked on mobile. They may share one row at ≥ 640 px of form width.
- **Lieferadresse / Delivery address:**
  - Notice: "Wir liefern derzeit nur innerhalb Wiens (PLZ 1010–1230)." / "We currently deliver only within Vienna (postcodes 1010–1230)."
  - Rows:
    - Straße und Hausnummer, full width.
    - Stiege/Stock/Tür (optional), full width or next to the street at ≥ 640 px.
    - PLZ next to the fixed "Wien", on one row at all widths. Wien is plain text, not a read-only input.
- Keep `autocomplete`, `inputmode` and the existing validation.

### Step 5: Übersicht (check-answers pattern)
Separate cards, each with an "Ändern" / "Change" link that has an accessible name (e.g. "Liefertag ändern"):
1. **Deine Kugeln:** one row per ornament, with the first photo thumbnail, color · finish, pet name and price. The name extra is its own priced sub-line.
2. **Lieferung:** the date and "abends, ohne feste Uhrzeit", then the address.
3. **Kontakt:** name, e-mail, phone.
4. **Summe:** ornaments subtotal, delivery ("Gratis" when it is 0) and total.

Then the must-know facts, once, above the terms checkbox:
- Personalised ornaments are made to order and cannot be returned. The owner must confirm this legal text.
- The name extra is not refunded if removed later.

Order button (Austrian § 8 (2) FAGG button rule):
- DE: **"Zahlungspflichtig bestellen"**; EN: **"Order and pay"**.
- A small line under it: "Weiter zu Stripe · € {total}" / "Continue to Stripe · € {total}".

## Staff UI
- **New sale:** colour picker with red, green and beige plus a finish choice (shiny or matte). Send `finish`.
- **Inventory:** one row per color and finish, e.g. "Red · shiny". Rows of old colors (grey, white) show under "No longer sold".
- **Order detail, agenda and deliveries:** show the finish next to the color.

## Mock
The mock (`frontend/src/api/mock/`) implements the same contract:
- Colors and finishes, with stock per combination.
- `deliveriesFrom`.
- `FORM_EXPIRED`.
- The waitlist confirm and unsubscribe flow.

## Form design rules (public forms: `/buy`, `/form`)

These rules were added after owner feedback on 2026-11-05 ("no hierarchy, no symmetry"). Every public form step must follow them.

Sources:
- [Baymard: avoid multi-column forms](https://baymard.com/blog/avoid-multi-column-forms)
- [NN/g: white space in forms](https://www.nngroup.com/articles/form-design-white-space/)
- [Scottish Government: form spacing](https://designsystem.gov.scot/guidance/forms/form-spacing)
- [GOV.UK: inset text](https://design-system.service.gov.uk/components/inset-text) and [warning text](https://design-system.service.gov.uk/components/warning-text)

**Layout**
- Single column.
- Fields share a row only when they form one entity: PLZ + Ort.
  - E-Mail and Telefon are never side by side.
  - Straße and Stiege/Tür are never side by side.
- Input width hints the expected length: PLZ is about 8rem, the other text fields go up to 34rem.
- The hint goes between the label and the input, so a field with a hint is taller. That is why fields with different hints never share a row: the inputs would not line up.

**Spacing (4-pt scale; proximity shows what belongs together)**

| Between | Space |
|---|---|
| Label and hint | 4px |
| Label (or hint) and input | 8px |
| Input and its error or count | 8px |
| Two fields | 24px |
| Two sections | 32px + 1px divider + 24px, at least 2× the field gap |
| Step title and first content | 24px (8px when an intro paragraph follows; the intro then has 24px below) |

**Type scale, three clearly different levels**

| Level | Size | Font | Weight |
|---|---|---|---|
| Step title (h2) | 1.625rem | Display (Baloo 2) | 700 |
| Section or card title (h3 / legend) | 1.25rem | Display | 700 |
| Field label | 1rem | Sans (Source Sans 3) | 600 |
| Hint and meta | 0.875rem | Sans | muted (#5c6b80) |

Headings use the display font and labels use the sans font, so they never look alike.

**Color roles**
- The light-blue `--snow` background is only for the product card and the cart (summaries of what is bought).
- Supporting information (Vienna only, finish explanation, photo reload, no-return notice) uses **inset text**:
  - a 4px neutral left border, no background, normal ink;
  - used sparingly, at most one per step.
- Errors are red.
- Selection is a dark border plus a ✓, so it never relies on color alone.
