## Recommendation

Make `/buy` feel like **creating a personal object first, checking out second**. Keep the existing five stages, but make the first stage a visual configurator: a large ornament responds immediately to color, finish, and the optional name. On desktop, keep the product and price visible beside the choices; on mobile, use a compact preview above the current decision.

This is a **design recommendation to test**, not a proven conversion improvement. Baymard’s research suggests that the number of fields and the effort they demand matter more than simply reducing the number of checkout steps. [Baymard: checkout fields and steps](https://baymard.com/research-articles/checkout-flow-average-form-fields)

The current implementation already provides a strong base: photo thumbnails, an availability calendar, editable review cards, a running total, and an availability recheck before payment. The work should build on these rather than replace the flow wholesale.

## What to borrow

- **Airbnb:** Its host setup breaks a substantial task into approachable decisions and allows people to return to their work. For AWG, use clear stage labels, one prominent decision at a time on mobile, and preserved answers when going back. [Airbnb Setup](https://news.airbnb.com/wp-content/uploads/sites/4/2022/11/Airbnb-2022-Winter-Release-Media-Guide.pdf)
- **Apple:** Make the object and personalization the hero. Apple presents engraving as part of making a product personal; AWG can apply that idea to the ornament’s back name. [Apple engraving](https://www.apple.com/shop/engraving)
- **Etsy:** Keep personalization requests specific and separate from inventory variants. Color and finish affect availability; a pet name or painting note tells the artist what to make. [Etsy custom options](https://help.etsy.com/hc/en-us/articles/360000344528-How-to-Offer-Personalized-Listings?segment=selling)
- **Baymard:** Use persistent labels, precise errors, and only necessary fields. Avoid interpreting a visually minimal form as necessarily easier. [Baymard form audit](https://baymard.com/learn/audit-checkout-flow-hidden-friction)

These references support the direction; they do not establish that a particular AWG layout or animation will perform best.

## Prioritized experience

### P0 — Make the choices clear and trustworthy

**1. Your ornament.** Show a real finished portrait ornament and a brief explanation: “Hand-painted in Vienna from your photos.” Below it, group color, finish, and optional back name in that order. Use labeled radio cards, not color alone. Show unavailable combinations as such and offer available alternatives. Select a default only if it is genuinely in stock; make the selection obvious and editable.

On desktop, use a two-column layout: product preview on the left, configuration on the right, with a sticky price summary where space allows. On mobile, show the preview above the controls and a compact bottom bar with total and **Continue**; ensure it never covers fields or keyboard focus. For multiple ornaments, show numbered items and **Add another ornament**, each with its own choices and pet details.

**2. Your pet.** Request the pet’s name, 1–6 photos, and an optional note. Give useful photo guidance before selection: “A clear, well-lit photo of the face works best.” Show each selected thumbnail, remove action, count, and specific file error. Preserve the current warning that photos must be re-added after reload.

Do **not** present the uploaded photograph as a predicted hand-painted portrait. If it appears inside the ornament shape, label it **“Photo reference — illustration only”** and show a real finished example alongside it. A hand-painted result will differ.

**3. Delivery.** Keep the calendar, but consider a short list of the next available dates above it, especially on mobile. Show the full localized date and “evening”; explain Vienna-only delivery and the delivery charge before selection. Use actual API availability, with loading, retry, and no-availability states. Do not say a date is reserved until the backend actually reserves it. If it becomes unavailable, retain the other answers and offer alternatives.

**4. Contact and address.** Group related fields on one screen; use visible labels, correct `autocomplete` attributes and mobile keyboard types. Mark optional fields explicitly. Validate after a field is left and on Continue, never while someone is still typing. Place an actionable message beside the field and move focus to the first error on submission. Keep optional address details available when needed for Vienna apartments.

**5. Review and pay.** Keep editable cards for each ornament, delivery, and contact. Show the base price, each €12.99 name option, delivery, and total before redirecting. Show the final personalized-product terms as approved by the legal adviser. Keep **“Zahlungspflichtig bestellen”** for German pending that review, and explain that payment continues on Stripe.

On return, show **“Confirming your payment…”** until the server confirms the payment; do not infer success from the redirect alone. Then show the order reference, delivery date, and next steps. Promise an email only when sending is actually configured. Stripe supports a hosted checkout and return page; fulfillment must rely on confirmed payment events. [Stripe Checkout](https://support.stripe.com/questions/stripe-checkout-embedded-full-page-vs-hosted-full-page?locale=en-GB), [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment)

### P1 — Reactive product preview

**Proposed visual spec — design judgment to validate with real product photography:**

- Use six consistent, optimized images for the three colors × two finishes, ideally photographed with identical lighting and angle. This shows actual material more honestly than changing an SVG fill. Preload the next likely assets; reserve their dimensions to avoid layout shifts.
- On selection, immediately update the radio state and price, then crossfade the matching image in **180–240 ms**. Include text such as “Red · Matte” so the choice is understandable without vision or color perception.
- Selecting the name option reveals the text field and an explicit **Front / Back** control. Show the typed name on a back-view asset in a representative style, labeled **“Preview of placement; hand lettering may vary.”** Keep exact capitalization visible and disclose the extra price before selection.
- No automatic spinning or simulated vibration. Use a small selection-ring or button-press response of **100–150 ms**, and a section reveal of **200–250 ms**, with `cubic-bezier(.2, 0, 0, 1)`. These durations are starting values, not standards.
- Respect `prefers-reduced-motion`: swap images and reveal content without nonessential movement. WCAG’s interaction-animation criterion is **AAA**, but supporting the preference is a useful inclusive baseline. [W3C: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)

Use warm, plain DE/EN copy: **“Choose your ornament” / “Wähle deine Kugel”**, **“Add a name on the back” / “Name auf der Rückseite hinzufügen”**. Explain craftsmanship and constraints concretely; avoid sales pressure or implying the preview is the final painting.

## Measurement plan

**Before redesign:** instrument the existing flow and collect a baseline for at least two weeks if traffic permits. Compare equivalent date ranges and device/language segments; seasonality and small visitor counts can overwhelm a before/after comparison.

| Measure | Definition and initial target |
|---|---|
| Funnel | Unique eligible visits reaching each stage; report stage-to-stage progression and `/buy` entry → **server-confirmed paid order**. Establish a baseline first; aim for improvement, not an invented universal conversion rate. |
| Field friction | `validation_error` by stage, field key and error code ÷ visits that attempted that stage. Target: downward trend; investigate any field above 10% as an initial threshold. |
| Task success | In moderated testing, complete a specified order through test payment without help. Initial aspiration: **4/5**, but use observations to find problems, not as a population estimate. |
| Time and ease | Record time per task and ask the 7-point **SEQ** after configuration and checkout; optionally use SUS or UMUX-Lite once after the whole experience. Compare with a larger sample before drawing numeric conclusions. |
| Reactivity | Field INP **≤200 ms at the 75th percentile**, separately for mobile and desktop; also inspect slow photo processing and configuration interactions. [web.dev: INP](https://web.dev/articles/inp) |

Track `buy_view`, `step_view`, `step_complete`, `option_selected` by option category, `photo_add_success/error`, `date_selected`, `validation_error`, `checkout_start`, `checkout_return`, and server-side `payment_confirmed/failed`. Define stage drop-off over a fixed observation window and count unique visits, not raw events. Deduplicate payment events server-side and distinguish abandoned, expired, failed, and still-pending sessions. Cross-domain Stripe returns, blockers, and incomplete sessions make funnel counts approximate.

Use Google’s **HEART** as a selection framework: happiness through SEQ, engagement through meaningful configuration, adoption through completed first orders, retention only if repeat ordering becomes relevant, and task success through completion and errors. [Google Research: HEART](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/)

Run **two rounds of five representative users**, including mobile, German and English speakers, and at least one keyboard or screen-reader user. Ask them to configure two different ornaments, recover from a bad photo or unavailable date, and explain the price and what the preview promises. Five users are useful for finding qualitative issues, not for statistically reliable rates. [NN/g: qualitative versus quantitative testing](https://www.nngroup.com/articles/5-test-users-qual-quant/)

For privacy, start with **aggregated server-side operational counts** and assess whether a cookieless product such as Plausible or a narrowly configured Matomo installation is necessary. Send no names, addresses, photos, entered text, form tokens, or full sensitive URLs to analytics; avoid session replay. **Cookieless does not automatically mean consent-free**, particularly in Austria: have the actual configuration and intended event-level funnel reviewed before promising a banner-free deployment. [CNIL: audience measurement conditions and national variation](https://www.cnil.fr/fr/node/677), [Matomo: consent by jurisdiction](https://matomo.org/faq/general/do-i-need-consent-to-use-web-analytics-on-my-website/)

No files were edited.

