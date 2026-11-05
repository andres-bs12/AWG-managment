Recommend an **optional checkbox card** for each ornament, directly below colour and finish.

At 360 px, give the card the available width, 16 px padding and a 44 px minimum checkbox hit area. Put the option and price on the first row. Beneath it, show two labelled 72 px ornament illustrations side by side: a sample pet portrait on the **front** and a blank back. Use the selected ornament colour. Label the images as illustrative; the portrait is not a preview of the customer’s pet.

**Copy**

- Checkbox: **„Name auf der Rückseite hinzufügen · +12,99 €“** / **“Add a name on the back · +€12.99”**
- Illustration labels: **„Vorne: Tierporträt“ · „Hinten: Name“** / **“Front: pet portrait” · “Back: name”**
- Input label: **„Name auf der Rückseite“** / **“Name on the back”**
- Hint: **„Max. 6 Buchstaben, in GROSSBUCHSTABEN.“** / **“Up to 6 letters, shown in CAPITALS.”**
- Policy, visible when selected: **„Wird der Name später entfernt, werden die 12,99 € nicht erstattet.“** / **“If the name is removed later, the €12.99 is not refunded.”**
- Preview caption: **„Schematische Vorschau“** / **“Illustrative preview”**

**States**

- **Off:** Unchecked; show both sides and the price. No input.
- **On, empty:** Reveal a full-width, labelled input below the images and the policy. The back remains blank.
- **On, typed:** Show the entered name in capitals on the back illustration and update the ornament price from €49.99 to **€62.98**. Keep the entered value when toggling off and back on.
- **Error:** On continuing, if empty or invalid, focus the input and show an associated message: **„Bitte gib 1–6 Buchstaben ein.“** / **“Please enter 1–6 letters.”** Preserve input rather than silently deleting unsupported characters.

Use a native checkbox, visible focus, a persistent input label and an associated error; keep the decorative preview hidden from screen readers. Show the selected name and surcharge again in review.

This combines [Etsy’s focused text field and add-on pricing](https://help.etsy.com/hc/en-us/articles/360000344528-How-to-Offer-Personalized-Listings?segment=selling) with the product preview used by [Bulgari](https://www.bulgari.com/en-al/services/engraving.html). [Baymard’s form research](https://baymard.com/blog/input-fields) supports clear labels and caution with restricted input; its [pricing research](https://baymard.com/research-articles/product-page-price-discounts) supports keeping prices conspicuous. No new dependency is needed.

