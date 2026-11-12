# Task C — UX writing pass + public fixes (2026-11-08)

Scope: `frontend/` only, plus this report and a short AGENTS.md note. Behaviour changes and every changed string are listed below for owner review. Staff UI copy was not touched. The `multi*` keys from Task B were left as delivered (already natural German; no rewording needed).

## Behaviour / code changes

| # | Change | Files |
|---|---|---|
| 1 | Default locale is now German; a stored choice still wins; `<html lang>` follows the locale at runtime | `src/i18n/LocaleContext.tsx`, `index.html` (`lang="de"`) |
| 2 | Vienna home delivery is a fixed window 18:00–20:00, Wed & Fri. One helper owns the constant and phrase | new `src/lib/deliveryWindow.ts`, consumers below |
| 3 | Thank-you page: one short line under the title (no e-mail claim and no planning talk); shows ALL ornaments of the order as a wrapping row of static previews; order code + copy, Track and calendar buttons kept | `src/pages/public/BuyThanksPage.tsx`, `src/pages/public/BuyPage.module.css` (`thanksPreviews`) |
| 4 | Satisfaction question: 1–5 native radios in a fieldset, end labels "sehr schwer … sehr leicht"; one answer only (no second `buy_seq` submission), chosen value and thanks stay visible. Event name `buy_seq` unchanged, value is a string | `src/pages/public/BuyThanksPage.tsx`, `src/pages/public/BuyPage.module.css` (`seqScale`, `seqOption`, `seqEnd`, `seqThanks`) |
| 5 | `.ics`: a Vienna delivery is now a timed event `DTSTART;TZID=Europe/Vienna:…T180000` → `…T200000` instead of all-day; market pickup unchanged | `src/pages/public/BuyThanksPage.tsx` |
| 6 | One phrase per chosen day ("Mittwoch, 2. Dezember 2026 · 18–20 Uhr") in Track, the QR form handoff and the thanks timeline; no more "Mi / Fr" next to a date | `src/pages/public/TrackPage.tsx`, `src/pages/public/FormPage.tsx`, `src/pages/public/BuyThanksPage.tsx` |
| 7 | Buy date step / review need no code change: the "Dein Termin" summary, earliest card and review rows now read "Mi, 2. Dez · 18–20 Uhr" through `eveningShort` | (key change only) |
| 8 | First-person "About" in the legal notice; legal placeholders untouched | `src/content/legal.ts` |
| 9 | Node test for the delivery window helper | new `tests/delivery-window.test.mjs` |
| 10 | Updated text assertions broken by the new copy: timeline window, `.ics` times, SEQ 1–5 + value '3', selected-date window, `afterPayment` | `e2e/success.spec.ts`, `e2e/design-system.spec.ts` |

## Copy changes — English (`src/i18n/LocaleContext.tsx`)

| Key | Before | After |
|---|---|---|
| deliveryMethod | How would you like to get it? | How would you like to receive your order? |
| methodViennaDetail | Wed & Fri evenings · {fee} | Wed & Fri · 6–8 pm · {fee} |
| pickupLead | … Gaby paints your ornament before that day. | … I paint your ornament before that day. |
| formBackNameHint | … we paint it as “Luna”. | … I paint it as “Luna”. |
| formCanEdit | … until Gaby starts painting. | … until I start painting. |
| formState_locked | Painting has started or your order has been handed over. Follow your order in Track. | I have started painting, or your order has already been handed over. You can follow it in Track. |
| afterPayment | Once payment is confirmed, Gaby paints your ornament for your chosen delivery day. | Once your payment is confirmed, I paint your ornaments in time for your chosen delivery day. |
| selectedDate | Selected: {date} · evening | Selected: {date} · 6–8 pm |
| eveningShort | evening | 6–8 pm |
| dateHelp | Postcodes 1010–1230. Delivery in the evening, with no fixed time. | Postcodes 1010–1230. Delivery between 6 and 8 pm. |
| previewReassure2 | Delivered in the evening | Delivery 6–8 pm |
| previewDisclaimer | Preview: Gaby paints your pet by hand. | Preview: I paint your pet by hand. |
| evening | evening, no fixed time | 6–8 pm |
| personalisedNoReturn | Personalised ornaments are made to order and cannot be returned. | Personalised ornaments are made just for you and cannot be returned. |
| buySoonBody | Custom ornaments are sold at the stall. Ask Gaby in the market — or track an order you already placed. | Custom ornaments are sold at my stall in the market — or track an order you already placed. |
| reviewLead | Make sure everything is right before it goes to Gaby. | Make sure everything is right before I start painting. |
| reviewFromStall | Set at the stall. Ask Gaby if something needs to change. | Set at the stall. Write to me if something should change. |
| saveCode | Keep this code to follow your ornament. | Keep this code to follow your order. |
| whenAtUntil | we are at {market} until {time} | I am at {market} until {time} |
| whenVienna | Home delivery in Vienna · Wed / Fri | Home delivery in Vienna |
| whenTbd | We will confirm the handoff soon. | I will confirm the handoff soon. |
| trackGreeting | Hi {name}, we have your ornament | Hi {name}, here is your order |
| formThanks | Thank you — we have everything | Thank you — I have everything |
| required | This field is needed. | Please fill this in. |
| shopLead | Hand-painted pet ornaments, delivered to your door in Vienna. | I hand-paint your pet on an ornament and deliver it to your door in Vienna. |
| shopIncludes | Includes a hand-painted pet portrait on an ornament. | I paint a portrait of your pet by hand on the ornament. |
| shopCustomHint | Your pet, hand-painted on an ornament. | I paint your pet by hand on an ornament. |
| shopAfterPayment | After payment, we confirm your order and plan the painting before your chosen delivery day. You can follow it with your order code. | After payment I paint your ornaments in time for your chosen delivery day. You can follow along with your order code. |
| shopBackNameHint | Up to 6 letters. Gaby paints the name in script. | Up to 6 letters. I paint the name in script. |
| shopDateLead | Within Vienna (postcodes 1010–1230), in the evening with no fixed time. | Within Vienna (postcodes 1010–1230), Wednesdays and Fridays between 6 and 8 pm. |
| shopCancelled | Payment was cancelled; nothing was charged. Your saved text is still here; please add your photos again if you reloaded the page. | Payment was cancelled and nothing was charged. Your answers are still here. If you reloaded the page, add your photos again. |
| shopThanksPlan | We plan the painting automatically before your chosen delivery day. Use the code below to follow your order. | I paint your ornaments and deliver them on your chosen day. |
| calendarDescription | Delivery in the evening. No fixed time. | Delivery between 6 and 8 pm. |
| legal.ts "About" | Gaby hand-paints Christmas ornaments in Vienna. | I am Gaby and I hand-paint Christmas ornaments in Vienna. |

## Copy changes — German (`src/i18n/LocaleContext.tsx`)

| Key | Before | After |
|---|---|---|
| deliveryMethod | Wie möchtest du sie bekommen? | Wie möchtest du deine Bestellung bekommen? |
| methodViennaDetail | Mi & Fr abends · {fee} | Mi & Fr · 18–20 Uhr · {fee} |
| pickupLead | … Gaby malt deine Kugel vorher. | … Ich male deine Kugel vorher. |
| formBackNameHint | Bis zu 6 Zeichen. Schon enthalten; wir malen ihn wie „Luna“. | Bis zu 6 Zeichen. Schon enthalten; ich male ihn wie „Luna“. |
| formCanEdit | … bis Gaby mit dem Malen beginnt. | … bis ich mit dem Malen beginne. |
| formState_locked | Die Bemalung hat begonnen oder deine Bestellung wurde übergeben. Verfolge deine Bestellung in Track. | Ich bin schon beim Malen oder deine Bestellung wurde übergeben. Du kannst alles in Track verfolgen. |
| afterPayment | Nach bestätigter Zahlung malt Gaby deine Kugel für den gewählten Liefertag. | Nach der Zahlung male ich deine Kugeln rechtzeitig zu deinem Liefertag. |
| selectedDate | Gewählt: {date} · abends | Gewählt: {date} · 18–20 Uhr |
| eveningShort | abends | 18–20 Uhr |
| dateHelp | PLZ 1010–1230. Lieferung am Abend, ohne feste Uhrzeit. | PLZ 1010–1230. Lieferung zwischen 18 und 20 Uhr. |
| previewReassure2 | Lieferung am Abend | Lieferung 18–20 Uhr |
| previewDisclaimer | Vorschau: Gaby malt dein Tier von Hand. | Vorschau: Ich male dein Tier von Hand. |
| evening | abends, ohne feste Uhrzeit | 18–20 Uhr |
| personalisedNoReturn | Personalisierte Kugeln werden auf Bestellung angefertigt und können nicht zurückgegeben werden. | Personalisierte Kugeln werden extra für dich angefertigt und können nicht zurückgegeben werden. |
| buySoonBody | Personalisierte Kugeln gibt es am Stand. Frag Gaby am Markt — oder verfolge eine bestehende Bestellung. | Personalisierte Kugeln gibt es an meinem Stand am Markt — oder verfolge eine laufende Bestellung. |
| reviewLead | Prüfe alles, bevor es an Gaby geht. | Prüfe alles, bevor ich mit dem Malen beginne. |
| reviewFromStall | Am Stand festgelegt. Frag Gaby, wenn sich etwas ändern soll. | Am Stand festgelegt. Schreib mir, wenn sich etwas ändern soll. |
| saveCode | Bewahre diesen Code auf, um dein Ornament zu verfolgen. | Bewahre diesen Code auf, um deine Bestellung zu verfolgen. |
| whenAtUntil | wir sind bis {time} am {market} | ich bin bis {time} am {market} |
| whenVienna | Lieferung in Wien · Mi / Fr | Lieferung in Wien |
| whenTbd | Wir bestätigen die Übergabe bald. | Ich melde mich bald zur Übergabe. |
| trackGreeting | Hallo {name}, wir haben deine Kugel | Hallo {name}, hier ist deine Bestellung |
| formThanks | Danke — wir haben alles | Danke — ich habe alles |
| required | Dieses Feld wird gebraucht. | Bitte ausfüllen. |
| copyFailed | Kopieren fehlgeschlagen. Bitte den Code auswählen und kopieren. | Kopieren hat nicht geklappt. Bitte den Code markieren und kopieren. |
| shopLead | Handbemalte Tierkugeln, direkt zu dir nach Hause in Wien. | Ich male dein Tier von Hand auf eine Kugel und liefere sie dir in Wien nach Hause. |
| shopIncludes | Enthält ein handgemaltes Tierporträt auf einer Kugel. | Ich male dein Tier von Hand auf die Kugel. |
| shopCustomHint | Dein Tier, von Hand auf eine Kugel gemalt. | Ich male dein Tier von Hand auf eine Kugel. |
| shopAfterPayment | Nach der Zahlung bestätigen wir deine Bestellung und planen das Bemalen vor deinem gewählten Liefertag. Mit deinem Bestellcode kannst du sie verfolgen. | Nach der Zahlung male ich deine Kugeln rechtzeitig zu deinem Liefertag. Mit deinem Bestellcode kannst du alles verfolgen. |
| shopBackNameHint | Max. 6 Buchstaben. Gaby malt den Namen in Schreibschrift. | Max. 6 Buchstaben. Ich male den Namen in Schreibschrift. |
| shopDateLead | Innerhalb Wiens (PLZ 1010–1230), abends ohne feste Uhrzeit. | Innerhalb Wiens (PLZ 1010–1230), mittwochs und freitags von 18 bis 20 Uhr. |
| shopCancelled | Die Zahlung wurde abgebrochen; es wurde nichts abgebucht. Deine gespeicherten Textangaben sind noch da; nach dem Neuladen musst du Fotos erneut hinzufügen. | Die Zahlung wurde abgebrochen und nichts abgebucht. Deine Antworten sind noch da. Wenn du die Seite neu geladen hast, füge die Fotos erneut hinzu. |
| shopThanksPlan | Wir planen das Bemalen automatisch vor deinem gewählten Liefertag. Mit dem Code unten verfolgst du deine Bestellung. | Ich male deine Kugeln und liefere sie an deinem Liefertag. |
| calendarDescription | Lieferung am Abend. Keine feste Uhrzeit. | Lieferung zwischen 18 und 20 Uhr. |
| legal.ts "Über ArtWithGab" | Gaby bemalt Weihnachtsornamente in Wien von Hand. | Ich bin Gaby und bemale Christbaumkugeln in Wien von Hand. |

Kept on purpose (owner-review candidates): "Notiz für Gaby (optional) / Note for Gaby (optional)" (the customer writes to Gaby, it is not the site speaking about her), neutral "wir" on pure logistics (Stripe payment note, Vienna-only notices, waitlist), and all legal/consumer passages were only polished, never changed in meaning; placeholders like `[E-Mail]` untouched.

## Verification status

- Ran in the sandbox (logic only): the `deliveryWindow` algorithm produces `Mittwoch, 2. Dezember 2026 · 18–20 Uhr`, `Friday 4 December 2026 · 6–8 pm`, ICS times `180000`/`200000` — matches `tests/delivery-window.test.mjs`.
- **Not run in this session** (the environment's approval callback denied every `node`/`npm` execution, including via background processes): `VITE_DATA_SOURCE=http npm run build`, `npm run lint`, `node --test tests/*.test.mjs`, Playwright. These remain to be run by the orchestrating agent.
- E2E text assertions that would otherwise break were updated proactively: `e2e/success.spec.ts` (timeline window, `.ics` timed event, SEQ radios 1–5, value '3'), `e2e/design-system.spec.ts` (selected-date window, `afterPayment`). Specs that set `awg-locale` explicitly are unaffected by the new German default; staff specs use hardcoded English staff copy, also unaffected.
- Per AGENTS.md, the visual snapshots in `a11y-visual.spec.ts-snapshots` must be deleted and regenerated by whoever runs Playwright next (thanks-page preview row and SEQ scale changed the UI).

## Open items

- Run build/lint/node tests/Playwright externally and regenerate visual snapshots (blocked here).
- The backend may expose the delivery window later; the constant lives only in `frontend/src/lib/deliveryWindow.ts` until then.
- `docs/design-system.md` still contains example copy with "abends / evening" (§7.11, V2) and "Mi & Fr abends · fee"; the owner's 18:00–20:00 decision supersedes those examples. The doc was not edited to avoid conflicts with concurrent agents.
