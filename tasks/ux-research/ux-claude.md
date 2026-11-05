# UX review: public shop `/buy` (ArtWithGab)

Reviewer: Claude (senior UX/form design). Date: 2026-11-05. No project files edited.
Inputs: the brief, `BuyPage.tsx` and `.module.css`, `buy/*Step.tsx`, `buy/shared.ts`, `i18n/LocaleContext.tsx`, `components/ui/Field.tsx`, `api/mock/services.ts`, `application.properties`. I also checked the running app at http://localhost:5174/buy at 360×740 and about 876 px wide (steps 1–2 only; I did not upload photos and did not open checkout).

Priority labels: **MUST** (fixes a bug, a legal risk or owner feedback that was explicitly requested), **SHOULD** (clear UX gain), **NICE** (polish).

---

## 0. Research basis (short)

| # | Finding | Source |
|---|---|---|
| R1 | Use a single-column form. 2–3 inputs may share a row **only when they form one entity** (city + postcode, the parts of a date). A two-column form is "never recommended". | https://baymard.com/blog/avoid-multi-column-forms |
| R2 | Hide a rarely used Address line 2 behind a link, unless most users need it. | https://baymard.com/blog/address-line-2 |
| R3 | Size each input to its content (postcode ≈ 10ch). Mark optional fields in the label. Use the autocomplete tokens `address-line1/2`, `address-level2` and `postal-code` (needed for WCAG 1.3.5). | https://design-system.service.gov.uk/patterns/addresses/ |
| R4 | A page-level "All fields are required" note is often missed. Mark fields on the field itself. | https://baymard.com/blog/required-optional-form-fields |
| R5 | When only a few dates are valid, show **only those dates** and grey out or omit the rest. Lists get tedious past ~10 options. Calendars suit dates within the next year. Spell out month names. | https://www.nngroup.com/articles/date-input/ |
| R6 | Users want a concrete **delivery date** ("Arrives Jan 26"), not a vague speed. | https://baymard.com/blog/shipping-speed-vs-delivery-date |
| R7 | Toggletip pattern: a real `<button type="button">` with an accessible name, the content in a `role="status"` live region, closed with Escape or an outside click. No `aria-describedby`. No interactive content inside. | https://inclusive-components.design/tooltips-toggletips/ |
| R8 | File upload: keep the text short, say the maximum file count, give a specific error message for each failure. | https://design-system.service.gov.uk/components/file-upload/ |
| R9 | After a client-side view change, focusing the heading tested best with screen-reader users. It is common to remove the outline for programmatic focus on `tabindex="-1"` elements, because they are not operable controls. | https://gomakethings.com/shifting-focus-on-route-change-with-react-router/ |
| R10 | WCAG 2.2 SC 2.5.8: pointer targets of at least 24×24 CSS px, or enough spacing. The project's 44 px `--touch` exceeds this. | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html |
| R11 | **Austria § 8 (2) FAGG (button rule):** the final order button must make clear that the order costs money. The WKO recommends the exact wording "zahlungspflichtig bestellen". If the button does not meet this, the consumer is not bound by the contract. | https://www.wko.at/internetrecht/der-bestell-buton-im-webshop |
| R12 | Personalised goods made to the customer's specification are excluded from the 14-day withdrawal right (§ 18 (1) Z 3 FAGG). Customers should be told this before paying. *Legal wording to be confirmed by the owner.* | (FAGG; same WKO portal) |

---

## 1. Global issues (all steps)

### 1.1 Black rectangle on the step heading (feedback 2): MUST
**Cause:** `.step h2:focus { outline: 2px solid var(--night) }` in `BuyPage.module.css`. The heading has `tabIndex={-1}` and receives focus programmatically after "Weiter".
**Fix:** keep the programmatic focus, because it is what makes screen readers announce the new step (R9). Drop the visual outline, because a `tabindex=-1` heading is not an operable control, so SC 2.4.7 does not require a focus indicator on it:
```css
.step h2:focus { outline: none; }
```
Do **not** use `:focus:not(:focus-visible)` for this. Chrome treats programmatic focus after a keyboard action (pressing Enter in a field) as focus-visible, so the box would still appear for anyone who submits with Enter.
Also call `headingRef.current?.focus({ preventScroll: true })` and scroll the **progress nav** into view instead of the h2 (see 1.3).

### 1.2 Stepper (feedback 1): MUST
- Centre the labels under the circles. Make each `li` a column flex box with `align-items: center; text-align: center`. Add a 2 px connector line between the circles (`::before` on each `li` except the first, positioned at `top: 14px`, from `-50%` to `50%`, behind the circle).
- Completed steps show a ✓ instead of the number. The green circle plus "1" currently reads as "step 1 is active".
- Shorten the labels so none wraps at 360 px. "Übersicht und Zahlung" currently wraps to 3 lines:

| step | DE | EN |
|---|---|---|
| 1 | Kugel | Ornament |
| 2 | Tier | Pet |
| 3 | Lieferung | Delivery |
| 4 | Adresse | Address |
| 5 | Zahlen | Pay |

  Keep the longer forms as the **h2** of each step (see the per-step headings below).
- Add an accessible step count with a visually hidden suffix: `<span class="visually-hidden">, Schritt 2 von 5</span>`. `aria-current="step"` is already present.
- **SHOULD:** make completed steps `<button type="button">` so a customer can jump back from the review step. Steps not yet reached stay plain text.
- At ≤ 360 px, use `font-size: .75rem` and keep every circle at 28 px. Five columns of ~56 px fit.

### 1.3 Scroll position and page header on mobile: SHOULD
At 360×740 the h1, lead, stepper and h2 take ~430 px before the first input. After "Weiter" the page scrolls to the h2 and **hides the stepper**, so the customer loses their sense of progress.
- On steps 2–5 (`step > 0`), hide the lead `shopLead` and reduce the h1 to `--fs-h2`. Or show the h1 and lead only on step 1.
- On step change, `navRef.current.scrollIntoView({ block: 'start' })` so the stepper and the heading are both visible.
- Update `document.title` per step, for example "Schritt 2 von 5: Dein Tier · ArtWithGab" (WCAG 2.4.2 for single-page app views).

### 1.4 Cart and the sticky bar on mobile: SHOULD
- At ≤ 500 px the page shows the same total twice (the aside "Dein Warenkorb" plus the sticky bar). Hide the aside on steps 1–4 on mobile. The sticky bar already shows the total. On step 5 the breakdown moves into the review (see §6), so drop the aside on step 5 as well.
- `.shop { padding-bottom: 8rem }` leaves a large empty white area under the sticky bar at the end of the card (confirmed at 360 px). Reduce it to the bar's real height (~88 px) or remove it. `scroll-padding-bottom` already protects the fields.
- Sticky bar copy: "Gesamt € 49,99" is good. On step 5 the button becomes the order button (see §6.4).

### 1.5 Copy principles: SHOULD
- One sentence per hint, ≤ 12 words. Say each fact once and in the place where it matters:
  - Vienna only: date step and address step.
  - Evening delivery: date step and review.
  - Name extra: item step and review.
  - Photo requirement: photo step.
  - Stripe: review step.
- Remove `shopRequiredFields` ("Alle Felder sind erforderlich…"). Baymard found that such notes are missed (R4). Fields are already labelled "(optional)".

---

## 2. Step 1: "Deine Kugeln" (items, colour, finish, name)

### 2.1 Product card: SHOULD
The current text has two sentences that say nearly the same thing ("Von Gaby nach den Fotos… bemalt." and "Enthält ein handgemaltes Tierporträt…"). Merge them into one:
- DE: **Personalisierte Tierkugel · € 49,99**, then "Gaby malt dein Tier nach deinem Foto, von Hand."
- EN: **Custom pet ornament · €49.99**, then "Gaby hand-paints your pet from your photo."

On mobile, put the image (60 px) left and the text right, with a 2-line maximum.

### 2.2 Colour + finish (new decision): MUST
**Data contract change:** replace `ShopColorOption { color; inStock }` with `ShopVariant { color: 'red'|'green'|'beige'; finish: 'shiny'|'matte'; inStock: boolean }` in both the frontend type and the backend DTO. `BuyItem` gains `finish`. `colorKeys` gains `beige` (DE "Beige", EN "Beige") and drops grey and white. Validation: the chosen (color, finish) pair must be in stock.

**Layout:** two small radio groups inside the item card, each a `fieldset` with a `legend`.

```
Farbe        (●Rot) (●Grün) (●Beige)
Oberfläche ⓘ (◐ Glänzend) (○ Matt)
```

- Show the **colour** as 32 px swatch circles with a text label below or beside them. Keep the existing chip style; the chip already has a ✓ when selected.
- Show the **finish** as two chips, each with a mini swatch in the *selected colour*:
  - shiny = radial-gradient highlight: `background: radial-gradient(circle at 30% 30%, #fff9 0 18%, transparent 40%), var(--swatch)`
  - matte = flat colour with no highlight.

  This shows the difference without text.
- **Disabled state:** first pick the colour, then the finish options for that colour reflect stock. A sold-out combination keeps `disabled` on the input, `data-disabled` styling and a "Ausverkauft" / "Sold out" `<small>`. If **both** finishes of a colour are sold out, disable the colour chip too. If the user changes colour and the current finish becomes unavailable, clear `finish` and show nothing until they choose (do not silently switch it).
- Default: preselect the first in-stock colour + finish **only if** stock is already loaded. Otherwise leave it empty. Preselecting removes one tap for most people. Today nothing is preselected, which caused the `shopChooseColor` error path.
- Do not use plain disabled grey text alone: the "Ausverkauft" text label is needed for contrast and screen readers (the current code already includes it in `aria-label`, keep that).
- The product art (`productArt`) should follow the chosen colour and finish.

**"?" toggletip next to "Oberfläche"** (R7):
```tsx
<legend>{t('shopFinish')} <button type="button" className={styles.infoBtn}
  aria-expanded={open} aria-controls={`finish-info-${uid}`}
  aria-label={t('shopFinishInfoLabel')} onClick={() => setOpen(o => !o)}>?</button></legend>
<div id={`finish-info-${uid}`} role="status">{open && <p className={styles.infoBubble}>{t('shopFinishInfo')}</p>}</div>
```
- Close it with Escape (keydown on the document while open, then return focus to the button) and with an outside click.
- Target size: the visible circle is 24 px, but `min-width/min-height: var(--touch)` keeps the hit area at 44 px (R10).
- A button inside a `legend` is allowed, and screen readers handle it. If you prefer, put it right after the legend in a flex row.
- Render the bubble inline (it pushes content down) rather than as an absolutely positioned popover. This avoids clipping at 360 px and needs no positioning library.

| key | DE | EN |
|---|---|---|
| `shopFinish` | Oberfläche | Finish |
| `shopFinishShiny` | Glänzend | Shiny |
| `shopFinishMatte` | Matt | Matte |
| `shopFinishInfoLabel` | Was ist der Unterschied? | What's the difference? |
| `shopFinishInfo` | Glänzend: spiegelt das Licht, Farben wirken kräftig. Matt: samtig, ohne Spiegelung, wirkt ruhig. | Shiny: reflects light, colours look bold. Matte: velvety, no reflections, a calmer look. |

### 2.3 Name on the back (feedback 3): MUST
Replace the plain checkbox row with a **compact option card**: checkbox on the left, text in the middle, a small illustration (56×56) on the right.

```
[☐] Name auf der Rückseite        [illustration]
    + € 12,99 · max. 6 Buchstaben
```
- **Illustration:** an inline SVG of about 40 lines, `aria-hidden="true"`, no image request. It shows the back of the ornament (the same circle and cap as `productArt`, in the chosen colour) with "LUNA" in small caps along the lower half, and a thin brush crossing the bottom-right with a wet tip. For motion, the letters can reveal left to right once (`stroke-dashoffset`, 1.2 s) when the box is checked, with no animation under `prefers-reduced-motion`. Size: `width: 56px` on mobile, 64 px on desktop. It must not grow the row taller than 64 px.
- When checked, show the input for the name **in the same card**. Show the hint as a placeholder-like example under the label, not as a separate paragraph.
- The input should mirror the typed name into the illustration (replace "LUNA"). This is cheap, delightful, and confirms the capitalisation rule visually. **NICE**
- Copy:

| key | DE | EN |
|---|---|---|
| `shopNameOnBack` | Name auf der Rückseite | Name on the back |
| `shopNameOnBackSub` | + {price} · max. 6 Buchstaben | + {price} · up to 6 letters |
| `backName` | Name (z. B. LUNA) | Name (e.g. LUNA) |
| `shopBackNameHint` | *(remove: covered by the sub-line and the input uppercasing)* | |

- **Non-refundable:** the owner's "if removed, no refund" rule is about in-person orders. For the web shop the relevant fact is that personalised ornaments cannot be returned (R12). Put that once on the review step (§6.3), not here. Do not add a third line here.
- **Accessibility:** remove the duplicate `aria-label` on the checkbox. It already sits inside a `<label>` with the same text, and the duplicate overrides the sub-line. Instead wire the sub-line through `aria-describedby`.

### 2.4 "Weitere Kugel hinzufügen": SHOULD
- Use a ghost/outline button with a "+" icon: "+ Weitere Kugel" / "+ Add another ornament".
- Show "Max. {max} Kugeln" only when the limit is reached (already done).
- Each extra card's heading "Kugel 2" should get a summary chip of colour + finish once collapsed. **NICE:** collapse non-active item cards to one line.

---

## 3. Step 2: "Dein Tier" (pet name, photos, note)

h2: DE "Dein Tier" / EN "Your pet" (unchanged).

### 3.1 Photo tiles (feedback 4): MUST
Replace the text button and the "0 von 6 Fotos" line with a tile row:

```
[thumb][thumb][ + ]
```
- The grid uses `display: grid; grid-template-columns: repeat(auto-fill, 76px); gap: 8px`. At 360 px, 3 tiles fit per row; at desktop, 6 fit.
- The **add tile** is a `<button type="button">` of 76×76 px with `border: 2px dashed var(--public-muted)` and `border-radius: 12px`. It contains a 28 px "+" icon (SVG) and the tiny caption "Foto" (.75rem).
  - Accessible name: `aria-label={t('shopAddPhotoN', { n: photos.length, max: 6 })}`, giving "Foto hinzufügen, 1 von 6" / "Add photo, 1 of 6".
  - It always sits **after** the last thumbnail and disappears at 6 photos (not disabled).
  - Keep `id="photos-${uid}"` on this tile so error focus still lands on it.
- **Empty state:** when there are 0 photos, show the add tile wider (full row, 76 px tall) with "+ Foto hinzufügen" so the first action is obvious. From 1 photo on it becomes the square tile.
- **Thumbnails:** 76×76 with `object-fit: cover`. Keep the remove "×" as it is: a 24 px visual inside a 44 px hit area.
  - Change `alt={photo.name}` (a camera filename like "IMG_4411.HEIC") to `alt={t('shopPhotoAlt', { n: i + 1, pet: item.petName || t('petName') })}`, giving "Foto 1 von Luna".
- **Upload feedback:** while `api.uploads.toPhoto` runs, show a placeholder tile with a spinner and `aria-busy`. HEIC conversion can take a second.
- Show the error under the grid, with a specific message for each failure (R8). The `photoInvalid` / `photoTooLarge` messages are already good.
- On a mobile file picker, `accept="image/*"` already offers both camera and gallery. Do not add `capture`.

**Hint copy (much shorter):**

| key | DE | EN |
|---|---|---|
| `formPhotos` | Fotos von {pet} *(fallback: Fotos deines Tiers)* | Photos of {pet} |
| `shopPhotosHint` | 1–6 Fotos, hell und scharf. | 1–6 photos, bright and sharp. |
| `shopPhotosWarning` | *(remove from the hint; show only as the existing `photosNeedReload` notice and in `shopStorageError`)* | |

**NICE:** under the hint, a 2-icon strip "✓ Gesicht gut sichtbar · ✗ dunkel/verwackelt". Do this only if the owner wants it; it adds visual weight.

### 3.2 Pet name: SHOULD
Put the pet name **first**, then photos. That order is already correct. Use `autoComplete="off"`, `autoCapitalize="words"`, `enterKeyHint="next"`.

### 3.3 Note for the painter: SHOULD
This optional textarea adds ~130 px per ornament. Collapse it behind a link-button "+ Notiz für Gaby (optional)" / "+ Note for Gaby (optional)" (the same pattern as Baymard's address line 2 finding, R2). If the note is non-empty, render the textarea expanded. Use `rows={3}`.

### 3.4 Card heading: NICE
"Kugel 1 · Rot" should include the finish: "Kugel 1 · Rot, matt". With a single ornament, omit "Kugel 1" and show only "Rot, matt" as a small chip.

---

## 4. Step 3: "Liefertag" (feedback 5)

h2: DE "Wann sollen wir liefern?" / EN "When should we deliver?"

### 4.1 Data reality and component choice: MUST
- Rule: Wednesday or Friday, only after the first market weekend (last weekend of November: Sat 28 / Sun 29 Nov 2026), and before season end. Fridays with a market stall are excluded.
- Realistic set: Wed 2, Fri 4, Wed 9, Fri 11, Wed 16, Fri 18 and Wed 23 Dec, minus market Fridays. That is **≤ 7 dates, all in December**.
- NN/g (R5): for ≤ ~10 known-valid dates, a list works. But the owner wants a calendar, and a calendar also communicates "only Wed/Fri" and "starts in December" at a glance without text. **Recommendation: a single-month calendar grid with no month navigation, showing only the month(s) that contain available dates** (normally just December). If the dates span two months, stack two grids vertically. Never add prev/next arrows.
- It must **not** depend on a date-picker library. It is a 7-column CSS grid built from the `dates` array.

### 4.2 Calendar markup (accessible, native radios): MUST
```tsx
<fieldset id="buy-date" tabIndex={-1} aria-describedby="buy-date-hint">
  <legend className="visually-hidden">{t('shopStepDate')}</legend>
  <h3 className={styles.month} aria-hidden="true">Dezember 2026</h3>
  <div className={styles.weekdays} aria-hidden="true">Mo Di Mi Do Fr Sa So</div>
  <div className={styles.calendar}>
    {cells.map(cell => cell.available
      ? <label className={styles.day} data-selected={selected === cell.date}>
          <input type="radio" name="delivery-date" className="visually-hidden"
                 aria-label={longDate(cell.date)} checked={...} onChange={...} />
          <span aria-hidden="true">{cell.day}</span>
        </label>
      : <span className={styles.dayOff} aria-hidden="true">{cell.day ?? ''}</span>)}
  </div>
</fieldset>
```
- Only available days are radios, so the arrow keys move between valid dates natively, and screen readers hear "Mittwoch, 2. Dezember, Optionsfeld, 1 von 6". Unavailable days are `aria-hidden` decoration.
- Week starts on Monday (de-AT and en-GB). Build the weekday header with `Intl.DateTimeFormat(locale, { weekday: 'short' })`.
- **Sizing at 360 px:** the panel's inner width is ~296 px, so 7 columns of ~40 px each.
  - Available day: 40 px circle with a 2 px `--night` ring and bold number.
  - Selected: filled `--green-deep`, white number, ✓ on the stepper.
  - Unavailable: `--public-muted` at 0.5 opacity, no ring.
  - 40 px is above the 24 px minimum (R10). With an 8 px gap there is no overlap.
- Focus: `.day:has(input:focus-visible) { box-shadow: var(--focus) }`.
- Do not highlight "today". It is outside the range and confuses people (R5 notes).
- Legend under the grid, a single line: "◯ = Liefertag möglich" / "◯ = available".
- **Below the grid**, once a day is selected, show a confirmation line (`aria-live="polite"`) that repeats the date in long form plus "abends": "Mittwoch, 9. Dezember · abends" / "Wednesday, 9 December · evening". This is the concrete-date confirmation Baymard recommends (R6).
- **Fallback:** if `dates.length > 15` (an unexpected config), keep the grid. It still works.

### 4.3 Copy: MUST
| key | DE | EN |
|---|---|---|
| `shopDateLead` | Wir liefern in Wien mittwochs und freitags **am Abend**. Eine feste Uhrzeit gibt es nicht. | We deliver in Vienna on Wednesday and Friday **evenings**. There is no fixed time slot. |
| `shopSeasonEnd` | Lieferungen vom {first} bis {last}. | Deliveries from {first} to {last}. |
| `shopDatesReady` | *(remove: the grid shows it; keep a visually hidden version for the live region)* | |
| `shopDatesNone` | Für diese Bestellung ist gerade kein Liefertag frei. Versuche es mit weniger Kugeln oder schau später wieder vorbei. | No delivery day is free for this order right now. Try fewer ornaments or check back later. |
| `shopDatesEarly` *(new, optional)* | Lieferungen starten nach dem ersten Marktwochenende, ab {first}. | Deliveries start after our first market weekend, from {first}. |

- Do not promise a callback or an exact hour unless the owner confirms it. If the owner can commit to a window (for example 17–21 Uhr), add it. **Owner question.**
- The calendar is shown before the address. Remind the customer that the delivery is Vienna-only here too (it is in the lead).

### 4.4 Data and logic issues found: MUST
1. `awg.shop.season-end=2026-12-24` (a Thursday), and the mock treats 24 Dec as a delivery day (`iso === '2026-12-24'` in `nextDeliveryDates`). This contradicts the "Wednesday or Friday" rule. Owner decision needed: is 24 Dec an exception? If not, the last date is Wed 23 Dec.
2. There is no "first delivery date" setting. Add `awg.shop.delivery-start` (for example `2026-12-02`), or derive it from the first market `MarketDay` + 3 days. The API should never return earlier dates, and the UI needs `{first}` for the copy. Expose it in `ShopConfig` (`deliveryStart`).
3. `ShopDeliveryDate.weekday` is in English (`Intl 'en'`). The UI should keep formatting the date locally (it already does with `formatDate`).

---

## 5. Step 4: "Deine Daten" (feedback 6)

h2: DE "Wohin liefern wir?" / EN "Where should we deliver?"

### 5.1 Grouping and order: MUST
Two `fieldset`s with visible legends shorten how long the step *feels*:

**Kontakt / Contact**
1. Name, full width, `autocomplete="name"`
2. E-Mail, full width, `type="email" autocomplete="email" autocapitalize="off" spellcheck="false"`
3. Telefon, full width, `type="tel" autocomplete="tel"`, with the hint "Nur für Rückfragen zur Lieferung." / "Only for questions about the delivery." Baymard says unexplained phone fields worry users.

**Lieferadresse (nur Wien) / Delivery address (Vienna only)**
- An info line first, styled as a small inline notice with a map-pin icon:
  - DE: "Wir liefern derzeit nur innerhalb Wiens (1010–1230)."
  - EN: "For now we only deliver within Vienna (1010–1230)."

  This replaces `shopPostalHint`, so the fact is said once (feedback: remind about Vienna).
4. Row A: **Straße und Hausnummer** (flex 1) | **Stiege/Tür** (width ≈ 9ch, optional)
5. Row B: **PLZ** (width ≈ 7ch, `inputmode="numeric" maxlength=4 autocomplete="postal-code"`) | **Ort**: the static text "Wien" in the same row.

### 5.2 Which fields may share a row (research-based): MUST
Per Baymard (R1), only fields that belong to one entity may share a row:

| Row | ≥ 480 px | 360 px | Why |
|---|---|---|---|
| Straße + Hausnr. · Stiege/Tür | side by side (`1fr 9rem`) | **side by side** (`1fr 6.5rem`); label "Tür" | Same address line. In Vienna "Gasse 12/3/14" is normal, so Tür is very common. Keep it **visible**, not behind a link (R2's condition is "most users don't need it", which is false in Vienna). |
| PLZ · Ort | side by side (`7rem 1fr`) | **side by side** | A classic same-entity pair. PLZ is 4 digits. |
| Name | alone | alone | Single "full name" field (Baymard prefers one field over first/last). |
| E-Mail · Telefon | **keep stacked** | stacked | Different entities. Baymard: a two-column layout is never recommended. Email needs the full width for long addresses. |

- CSS: `.row { display: grid; grid-template-columns: 1fr 6.5rem; gap: var(--space-3); } @media (min-width: 480px) { .row { grid-template-columns: 1fr 9rem; } }`. The PLZ row uses `7rem 1fr`.
- Do **not** keep the read-only "Wien" text input. A read-only field looks editable and confuses people. Render instead `<div className={styles.staticField}><span className={styles.label}>Ort</span><span>Wien</span></div>`, keep sending `city: 'Wien'`, and keep `autocomplete="address-level2"` out of it.
  - If browser autofill fills a different city, there is no field to receive it. That is fine, because the PLZ is validated.
- Labels:

| key | DE | EN |
|---|---|---|
| `shopStreet` | Straße und Hausnummer | Street and number |
| `shopLine2` | Stiege/Tür (optional) | Flat (optional) |
| `shopPostal` | PLZ | Postcode |
| `shopCity` | Ort | City |
| `shopPostalInvalid` | Bitte eine Wiener PLZ eingeben (1010–1230). | Enter a Vienna postcode (1010–1230). |

  "(optional)" may wrap on 360 px in the narrow column. Use the label "Tür (optional)" and allow two lines, or put the optional marker in the hint.
- Validate on blur (not on every keystroke) for email and PLZ, and clear the error on change (already done).
- Remove `shopRequiredFields` (R4).

### 5.3 Small bugs: SHOULD
- `buy-line1` has no `maxLength`. Add 200.
- The `line2` field has no `aria-invalid`/`aria-describedby`, while the server can return `address.line2` errors (it is mapped in `pay()`). The `Field` component injects these automatically, so it is fine, but the explicit `aria-*` props on the other inputs are redundant with `Field`'s `cloneElement`. Pick one mechanism.
- The source has odd blank lines inside the JSX attributes (all step files). This is a cosmetic code-hygiene issue.

---

## 6. Step 5: "Übersicht und Zahlung" (feedback 7)

h2: DE "Alles richtig?" / EN "Everything correct?"

### 6.1 Structure: separate products from delivery: MUST
Use three visually separate sections, each a small card with an h3 and a right-aligned "Ändern"/"Edit" link-button that calls `go(n)`:

```
┌ Deine Kugeln ─────────────────── Ändern ┐
│ [photo thumb] Kugel 1 · Rot, glänzend  € 49,99 │
│               Luna · 2 Fotos                   │
│               + Name „LUNA“            € 12,99 │
│               Notiz: „…“ (1 line, ellipsis)    │
└────────────────────────────────────────┘
┌ Lieferung ───────────────────── Ändern ┐
│ 🗓 Mittwoch, 9. Dezember · abends         │
│ 📍 Gasse 12/3, 1070 Wien                  │
└────────────────────────────────────────┘
┌ Kontakt ─────────────────────── Ändern ┐
│ Anna Muster · anna@… · +43 …            │
└────────────────────────────────────────┘
┌ Summe ─────────────────────────────────┐
│ Kugeln (2)                     € 99,98 │
│ Namen auf der Rückseite (1)    € 12,99 │
│ Lieferung                       Gratis │
│ Gesamt                        € 112,97 │
└────────────────────────────────────────┘
```
- Each item line uses the first photo as a 48 px thumbnail (it is in memory as `dataUrl`). This confirms the right pet visually and replaces the text "Fotos: 2".
- The name extra appears as **its own priced sub-line** under the item, so the € 12,99 is transparent. Currently it is folded into the item price, which differs from the € 49,99 shown in step 1.
- The address moves to **Lieferung** together with the date (where the ornament goes and when). Contact is separate (who we talk to).
- The totals move inside the review, replacing the aside on this step. Use `<dl>` as today.
- Spacing: 16 px padding in each card, 12 px gap between cards, h3 at 1rem/700, muted small text for secondary lines. Never more than 2 text lines per item at 360 px.

### 6.2 "Edit" links: SHOULD
The links use `<button type="button" className={styles.linkBtn} aria-label="Kugeln ändern">Ändern</button>`, which jumps to the step. After an edit, "Weiter" goes forward step by step. That is acceptable. **NICE:** add a "Zurück zur Übersicht" button when the user arrives from the review.

### 6.3 Must-know facts, once, right above the checkbox: MUST
A compact list with icons (it replaces `shopPayNote` and `shopAfterPayment`):

| DE | EN |
|---|---|
| 🔒 Bezahlung über Stripe – wir sehen deine Kartendaten nie. | 🔒 Payment via Stripe – we never see your card details. |
| 🎨 Personalisierte Kugeln sind vom Umtausch und Widerruf ausgeschlossen. | 🎨 Personalised ornaments can't be returned or exchanged. |
| 📦 Nach der Zahlung bekommst du per E-Mail deinen Bestellcode zum Verfolgen. | 📦 After paying you'll get your order code by e-mail to track it. |

- The second line (R12) is **legal wording to be confirmed by the owner**. It also covers the owner's "name extra is non-refundable" concern in the web context.
- Only say "per E-Mail" if SMTP is live. Otherwise use "Nach der Zahlung zeigen wir dir deinen Bestellcode." Per AGENTS.md, never claim a notification that may not be sent. **Owner question.**

### 6.4 Order button and legal wording (Austria): MUST
- § 8 (2) FAGG / WKO (R11): the final button should read **"Zahlungspflichtig bestellen"**. The current "Sicher mit Stripe bezahlen" risks the contract not being binding. German courts rejected "Weiter zur Zahlung" for the same reason.
- Recommendation:
  - Button: DE **"Zahlungspflichtig bestellen"** / EN **"Order and pay"**. The EN wording is not legally prescribed, but keep it unambiguous.
  - Under the button, small text: "Weiter zu Stripe · € 112,97" / "Continues to Stripe · €112.97".
  - Busy state: "Weiter zu Stripe…" / "Taking you to Stripe…".
- The terms checkbox:
  - DE: "Ich akzeptiere die [AGB] und die [Widerrufsbelehrung]."
  - EN: "I accept the [terms] and the [cancellation policy]."

  Today only the AGB is linked. Link the cancellation policy too, or anchor to it in the AGB.
- Move the privacy link out of the checkbox label into a small line: "Datenschutz: [Datenschutzerklärung]". Consent to the privacy notice should not be bundled into the terms checkbox.
- **Owner/legal check needed** for both the button wording and the withdrawal-exclusion line.

### 6.5 Error display: SHOULD
`serverError` currently renders below the checkbox, possibly off-screen at 360 px. Render it at the top of the step and focus it, or render it directly above the sticky bar with `role="alert"`.

---

## 7. Accessibility checklist (cross-cutting)
- MUST: keep `aria-current="step"` and the heading focus (§1.1), and add `document.title` per step.
- MUST: every radio group (colour, finish, date) is a `fieldset` + `legend`. Sold-out options stay `disabled` and are announced with "Ausverkauft".
- MUST: the toggletip uses a button + `role="status"`, closes on Escape and returns focus (§2.2).
- MUST: targets are ≥ 24 px visual and 44 px hit area. Calendar days are 40 px.
- SHOULD: the colour swatch alone never carries meaning (there is always a text label). The beige swatch needs a `#0004` border on the white card (already present).
- SHOULD: error focus `showErrors()` targets ids that remain valid after the redesign: `photos-${uid}` on the add tile, `buy-date` on the fieldset, `finish-${uid}` on the new fieldset.
- SHOULD: `prefers-reduced-motion` disables the name-painting animation and any calendar transitions.

## 8. Things I could not verify
- Steps 3–5 were reviewed from code only. Step 2 requires a photo, and I did not upload one or submit anything.
- The legal points (R11, R12) are research pointers, not legal advice. The owner should confirm them.

---

## Top 10 recommendations (priority order)
1. **MUST:** Remove the heading outline with `.step h2:focus { outline: none }` (keep the programmatic focus). Scroll the stepper into view, not the h2. Set `document.title` per step.
2. **MUST:** Order button wording "Zahlungspflichtig bestellen" (§ 8 (2) FAGG), with "Weiter zu Stripe · total" below it. Add the line "personalised ornaments can't be returned" (owner/legal to confirm).
3. **MUST:** Delivery date as a **single-month calendar grid** of native radios (only Wed/Fri available days are selectable, 40 px circles). Then a confirmation line "Mittwoch, 9. Dezember · abends". Lead text: "mittwochs und freitags am Abend, keine feste Uhrzeit."
4. **MUST:** Fix the date data. Add `delivery-start` (first Wed after the last November weekend). Resolve the 24-Dec Thursday exception that contradicts the Wed/Fri rule.
5. **MUST:** Colour (Rot/Grün/Beige) + finish (Glänzend/Matt) as two radio groups, stock per pair, sold-out combinations disabled with a text label. Finish chips show a shiny vs. flat mini swatch, plus a "?" toggletip (button + `role="status"`, closes on Escape).
6. **MUST:** Photo **tile grid**: 76 px thumbnails followed by a dashed "+" add tile that moves right and disappears at 6. Hint "1–6 Fotos, hell und scharf." Meaningful `alt` text and an upload spinner tile.
7. **MUST:** Review step split into **Kugeln / Lieferung (date + address) / Kontakt / Summe** cards with "Ändern" links. The name extra is a separately priced sub-line, and a photo thumbnail is shown per item.
8. **MUST:** Contact step: two fieldsets (Kontakt; Lieferadresse with a "nur Wien (1010–1230)" notice). Only same-entity rows: **Straße | Tür** and **PLZ | Wien** (also at 360 px). Email and phone stay stacked. Replace the read-only "Wien" input with static text.
9. **MUST:** Stepper: labels centred under the circles, a connector line, ✓ on completed steps, and short labels (Kugel · Tier · Lieferung · Adresse · Zahlen) so nothing wraps at 360 px.
10. **SHOULD:** Cut the text and chrome:
    - merge the product card into one sentence
    - name extra as a compact card with a 56 px "LUNA + brush" SVG
    - collapse the optional painter note behind "+ Notiz"
    - remove "Alle Felder sind erforderlich"
    - hide the duplicate cart total and the 8rem blank space on mobile
    - hide the lead after step 1
