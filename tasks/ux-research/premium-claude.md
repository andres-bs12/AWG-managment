# /buy: making it feel premium and reactive (Claude, product design and UX research)

Tags: **[E]** means evidence-based (research or standard, cited). **[T]** means taste, or a pattern borrowed from Airbnb or Apple without a published outcome. **[O]** means something I observed in the running app (localhost:5174/buy at 375 px and about 800 px, 2026-11-05).

## 0. What exists today [O]
- Step 1 is solid but plain. A 50 px static cat ornament sits next to the price. Colour and finish are small chips. The name toggle shows a front and back pair, and only the **back** changes colour. The front (`PetOrnamentMini`) never reacts to colour or finish.
- The product image is not the hero. Nothing grows, rotates or flips when the user makes a choice.
- At ~800 px the cart sits under the form, not beside it. There is no two-column layout yet.
- Photos (step 2) are disconnected from the ornament. Thumbnails show, but the customer never sees "their pet on the ball".
- The sticky mobile footer with the total and Continue works well. Keep it.

## 1. Structure: 5 steps → 3 screens plus Stripe
Baymard's checkout research finds that step count matters less than the burden of fields per step. Its ideal checkout has 7–8 fields (average 14.88), and "too long/complicated" causes 17 % of abandonment [E] ([Baymard one-page vs multi-step](https://baymard.com/blog/one-page-checkout), [Baymard abandonment](https://baymard.com/lists/cart-abandonment-rate)). GOV.UK recommends one question per page by default and grouping only when research supports it [E] ([GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/)). Airbnb's 2016 redesign used one- or two-question "sheets" [T/E-anecdotal] ([Wired](https://wirednews.pages.dev/2016/04/airbnbs-new-app-overhauls-user-experience)).

Recommendation (the merge is [T], the grouping logic is [E]):

| Screen | Content | Why |
|---|---|---|
| **1. Design your ornament** (configurator) | Pet photo(s) → colour → finish → name on back → pet name | Every choice changes the product, so all of them belong next to the live preview. Photo moves first because it is the most emotional input and makes the preview personal (Nike By You: "the 3D image of your shoe is updated instantly", [Nike](https://www.nike.com/help/a/what-is-nikeid)). |
| **2. Delivery** | Date (Wed/Fri evening) + name, email, phone, Vienna address | These are logistics. About 7 fields fits Baymard's ideal. |
| **3. Review & pay** | Editable summary ("Change" links), terms, Pay with Stripe | GOV.UK "Check answers" pattern [E]. |

- **Mobile (<768 px):** keep the configurator as **sub-steps inside screen 1**, one decision per view: Photo → Colour → Finish → Name. A compact preview (~40 % of viewport height) stays sticky at the top, and the choices scroll below it. Progress shows 3 dots, not 5.
- **Desktop (≥1024 px):** two columns in the Apple-buy-page style. On the left, a large sticky preview (≈55 %). On the right, choices stacked in sections that reveal progressively. The sticky summary card shows the price breakdown, like Airbnb's reservation card [T].
- Add-another-ornament becomes "Add another ornament" on the review screen, plus "duplicate this design". Most orders are single, so don't put a multi-item editor first [T].

## 2. Live ornament preview spec
Build it as **one SVG component**, `<OrnamentPreview color finish photoUrl name side />`, at viewBox 0 0 400 480, with layers that only change `fill`, `opacity` and `transform`. That keeps it cheap for INP.

| Choice | Visual change | Motion |
|---|---|---|
| Colour | Ball base fill crossfades. The gold cap stays. | 200 ms `ease-out` on fill (CSS `transition: fill`) |
| Finish | Shiny: specular highlight arc + radial gradient + a slow 1.2 s glint sweep once. Matte: highlight off, flatter gradient, subtle noise texture. | 250 ms opacity; glint 900 ms once, never looped |
| Photo uploaded | A centred circular cutout of the first photo, with a painterly SVG filter (`feTurbulence` + slight blur, or CSS `filter: saturate(1.1) contrast(1.05)` + a brushstroke ring mask), labelled **"Preview: Gab paints it by hand"** | Scale 0.9→1 + fade, 300 ms `cubic-bezier(.05,.7,.1,1)` (M3 emphasized-decelerate) |
| Name on back toggled on | The ornament **flips to the back** (rotateY 180°), shows the name in the gold lettering face, and offers a "Front/Back" segmented toggle | 450 ms flip (the one "big" motion). Reduced motion: crossfade |
| Name typed | Text updates live per keystroke and auto-fits (6 chars max) | none (instant = reactive) |
| Price change | Total in the sticky bar ticks over | 150 ms vertical slide of digits, or simple fade |

- **Idle sway:** a ±3° pendulum on the hook, 4 s, only while idle. It pauses on interaction and is off under `prefers-reduced-motion` [T, with 2.2.2/2.3.3 compliance].
- Always show an honesty note: "Illustration. Your ornament is painted by hand from your photos." This sets expectations for a hand-made product [T].
- Sold-out colours stay visible but disabled, with "Sold out · Notify me" (waitlist exists). Don't hide them [E-ish: Baymard-style transparency; T].

## 3. Micro-interactions (durations and easing)
NN/g: 100 ms for simple feedback, 200–300 ms for larger changes, avoid ≥500 ms, ease-out to enter and ease-in to exit, exits shorter than entrances [E] ([NN/g animation duration](https://www.nngroup.com/articles/animation-duration/)). M3 tokens: emphasized-decelerate `cubic-bezier(.05,.7,.1,1)` to enter, emphasized-accelerate `cubic-bezier(.3,0,.8,.15)` to exit [E, token values].

Tokens to add to `styles/tokens.css`:
```
--dur-1: 100ms;  /* chip press, checkbox */
--dur-2: 200ms;  /* colour fill, error appear */
--dur-3: 300ms;  /* sub-step enter, photo pop */
--dur-flip: 450ms; /* ornament flip only */
--ease-enter: cubic-bezier(.05,.7,.1,1);
--ease-exit: cubic-bezier(.3,0,.8,.15);
```
- **Choice chips:** become large cards (≥56 px tall, swatch 32 px). On select, a 100 ms scale 0.97→1, a 2 px ring and a checkmark. Do not rely on colour alone.
- **Sub-step transitions:** 300 ms enter with an 8–16 px slide + fade, 200 ms exit. Focus moves to the new heading (already done).
- **Continue button:** disabled-looking until valid is an anti-pattern. Keep it enabled and validate on press (current behaviour, keep it) [E: GOV.UK].
- **Reduced motion:** every transform becomes an opacity crossfade ≤150 ms. The flip becomes a fade. No idle sway [E: WCAG 2.3.3 AAA, [W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)].
- **"Haptics-like" feedback:** a tiny bounce on the swatch plus `navigator.vibrate(10)` on Android only, behind a feature check [T].

## 4. Copy tone [T]
Warm, short, second person, and German first. Write headings as questions: "Wer wird gemalt?" / "Who are we painting?", "Welche Farbe soll die Kugel haben?". Hint text is one sentence with no full stop, per GOV.UK [E]. Put money facts next to the choice: "+€12,99 · not refundable if removed later". Replace "Weiter" on the final configurator sub-step with an outcome label: "Lieferung wählen".

## 5. Photo upload
- First sub-step: a big drop zone / camera button reading "Add 1–6 photos of {pet}". Accept multi-select, and show thumbnails with an upload ring that turns into a check in 300 ms.
- **The first photo goes straight into the ornament preview.** This is the "wow" moment. Tap a thumbnail to make it the preview photo.
- Show a light, friendly quality hint: "Clear face, good light, eyes visible". Flag low resolution (<800 px short side) with a soft warning, not a block [T].
- Show the "Fotos nach dem Neuladen erneut hinzufügen" warning **before** leaving, not only after reload.
- Pet name lives in the same sub-step ("What's their name?"). It feeds "Add photos of Luna" and the name-on-back default (prefill an uppercase 6-character slice; the user can edit) [E: GOV.UK reuse answers].

## 6. Delivery date picker
Only Wed and Fri evenings are bookable, so a full month grid is mostly dead cells. Replace it with a **horizontal list of date cards** ("Mi 25. Nov · 18–21 Uhr"), the next 6–8 available dates, plus "More dates". Show the earliest date pre-highlighted as "Earliest", **not pre-selected** [T]. The current grid works but shows 30 cells for about 8 choices. Delivery speed drives 20 % of abandonment, so put "earliest delivery" on screen 1 as well [E: Baymard reasons].

## 7. Contact and address
- 6 fields: name, email, phone, street + number, door/Stiege (optional), PLZ. City is fixed to "Wien". Validate the PLZ as 1010–1230 on blur [E: Baymard inline validation: validate on blur, clear errors on keystroke, positive check marks, [Baymard](https://baymard.com/blog/inline-form-validation)].
- Autocomplete attributes already exist (keep them). Address autocomplete beats manual entry; 9 % of manual addresses have typos [E: [Baymard address lookup](https://baymard.com/blog/automatic-address-lookup)]. This is optional and low priority for Vienna-only; a PLZ check is enough.
- Explain why the phone is needed: "Only if we can't find your door".
- Pass `customer_email` to Stripe Checkout so the customer doesn't type it twice [E: [Stripe API](https://stripe.com/docs/api/checkout/sessions)].

## 8. Review and pay
- Show a mini ornament render per item (the same component, static), with colour, finish, name, pet and photos count, and a "Change" link back to the exact sub-step.
- Lay out the total clearly: items, name add-on, delivery (Free), total. 12 % abandon when the total isn't clear upfront [E].
- Trust row: "Secure payment with Stripe · Apple Pay · Google Pay · Card", the cancellation policy, and a hand-painted-in-Vienna note. Trust issues cause 19 % of abandonment [E].
- Pay button: "Pay €62,98" (amount in the label) [T, Apple/Stripe pattern].

## 9. Loading and success
- **Loading:** skeletons for colours and dates, sized to the final layout (no layout shift). On Pay, the button shows a spinner and "Opening secure payment…", and it locks double taps.
- **Success page:** the ornament render, "Gab starts painting {Luna} soon" (an illustration, not an emoji). Include a timeline (Paid → Painting → Delivery Wed 25 Nov evening), the order code, a link to Track, and "Add to calendar (.ics)". Play a one-time 600 ms celebration (snow burst) that is skipped under reduced motion [T].
- **Cancelled Stripe return:** "No charge was made. Your design is saved", with the draft intact [T].

## 10. Measurement plan
**Framework:** HEART with Goals→Signals→Metrics, using Task success, Happiness and Adoption only [E: Rodden et al., CHI 2010, summary [Lyssna](https://www.lyssna.com/blog/google-heart-framework/)].

**Analytics:** cookieless and EU-hosted (Plausible or self-hosted Umami). No identifiers and no banner needed per vendor; confirm with counsel [E-vendor: [Plausible data policy](https://plausible.io/data-policy)]. Never send PII, the pet name or the address as properties.

| Event | Props |
|---|---|
| `buy_view` | lang, device |
| `buy_substep_view` | step (photo, colour, finish, name, delivery, review) |
| `buy_choice` | field (colour/finish/name_on/off), value |
| `buy_photo_added` | count, ms_to_process, rejected_reason |
| `buy_validation_error` | field id, error code (no value) |
| `buy_preview_flip` | — |
| `buy_pay_click` | items, total_bucket |
| `buy_paid` (server-side, from the Stripe webhook) | items, revenue |
| `buy_stripe_cancel` | — |

**Targets for the first season (taste, to recalibrate after 2 weeks):**
- Funnel view→pay_click ≥ 35 %; pay_click→paid ≥ 80 %. Find the step with the largest drop and fix that first.
- Validation errors: < 0.3 per completed order; no single field > 10 % of sessions.
- Median time to complete < 4 min (photos excluded).
- INP p75 ≤ 200 ms on mobile, LCP ≤ 2.5 s, CLS ≤ 0.1. Collect field data with the `web-vitals` library sent to the same analytics [E: [web.dev INP](https://web.dev/articles/inp)].
- Happiness: an SEQ (1–7) on the success page, "How easy was ordering?", target mean ≥ 6. A UMUX-Lite pair can go in the follow-up email [E: [MeasuringU UMUX-Lite](https://measuringu.com/umux-lite/)].

**Qualitative:** run 3 rounds × 5 users (DE and EN, on mobile, given the task "order an ornament of your pet for delivery") before launch, after the fixes, and mid-season. Five users find about 85 % of problems [E: [NN/g](https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/)]. Record task success, time, SEQ per task, and the moment the user "gets" the product (a think-aloud quote when the preview reacts).

## Top 12, prioritised
1. Live `OrnamentPreview` as the hero: colour and finish fill, photo on the front, flip to the back for the name [T + Nike/Apple precedent].
2. Restructure to 3 screens: Design → Delivery → Review/Pay [E Baymard field burden + T].
3. Photo first; the first photo appears on the ornament immediately [T].
4. Mobile: sticky compact preview + one decision per sub-step. Desktop: 2 columns + sticky summary [E GOV.UK / T Apple-Airbnb].
5. Motion tokens: 100/200/300 ms, 450 ms flip only, M3 easing [E NN/g, M3].
6. `prefers-reduced-motion` turns everything into fades, with no idle sway [E WCAG 2.3.3].
7. Date cards instead of the month grid, plus "earliest delivery" shown upfront [T + E Baymard 20 %].
8. Address: 6 fields, Wien fixed, PLZ 1010–1230 validated on blur, positive checks [E Baymard].
9. Review with mini renders, "Change" links, a clear total, a trust row, and "Pay €X" [E Baymard 12 %/19 %].
10. Reuse answers: pet name → photo prompt, back-name default, email → Stripe prefill [E GOV.UK, Stripe].
11. Success page with a render, timeline and .ics; a saved draft after a Stripe cancel [T].
12. Cookieless funnel events + web-vitals INP + success-page SEQ + 3×5 user tests [E].
