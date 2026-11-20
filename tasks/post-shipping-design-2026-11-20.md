# Design: replace hand delivery in Vienna with shipping by Austrian Post (owner, 2026-11-20)

**Read-only design task. No code changes.** Output: `tasks/audit-results/post-shipping-design-2026-11-20.md`.

## What the owner wants
- The "Lieferung in Wien" option (Gaby hands it over Wed/Fri 18–20) goes away. Instead the customer pays
  **+5 €** and the ornament is **sent by post** (Österreichische Post).
- Example: an order on Saturday, painted on Sunday, finished Sunday. On one or two fixed weekdays per week
  (depending on how many ornaments are waiting) the Post is asked to come and collect the parcels. Delivery
  is about **2–3 working days after the collection** (collection day must be a working day too).
- We do **not** promise an exact date, only a **range** ("delivered between Tue 2 and Thu 4 Dec").
- If, by this calculation, the ornament cannot arrive **before Christmas**, it must **not be sold** with
  shipping (pickup at a market may still be possible).
- Applies to the web shop (`/buy`) and to staff New sale (today "Vienna" delivery mode). The owner will
  decide the details from your proposal.

## What to study in the repo
AGENTS.md (domain rules, delivery window, `awg.shop.deliveries-from`, season end 24 Dec, capacity rules),
`docs/README.md`, `awg-tracking/README.md`, backend `ShopService`, `OrderService`, `AgendaService`,
`CalendarRules`, `InvoiceRenderer`, `NotificationService`, `Track`; frontend `/buy` delivery step,
`lib/deliveryWindow.ts`, New sale delivery modes, Deliveries page, Track page. Data model: `Order` delivery
address, `OrderItem` handoff.

## The proposal must answer
1. **Date range algorithm** (pure function, deterministic, Europe/Vienna): order date → earliest paint slot
   (existing capacity) → ready date → next post collection day (configurable weekdays, e.g. Tue + Fri;
   working days only, Austrian public holidays incl. 8 Dec Mariä Empfängnis) → delivery range
   = collection + N..M working days (configurable, default 2..3). Show worked examples for orders on
   Sat 28 Nov, Wed 9 Dec, Thu 17 Dec, Sun 20 Dec 2026. Define the **last order date** with shipping so it
   arrives by 24 Dec, and how that cut-off is enforced in the shop and in New sale.
2. "One or two collection days per week depending on volume": propose something simple and safe
   (fixed configurable weekdays first; staff can add an extra collection day in the agenda?) and say what
   is automatic vs manual.
3. **Address scope**: all of Austria or only Vienna? EU? Postcode validation. Shipping fee 5 € as a price
   setting (editable in Stock like other prices, `price_setting`).
4. **Data model & migration** (next free Flyway number after V16): delivery kind `post`, address on
   `Order`, collection date, tracking number (optional, staff enters it), shipped/handed-to-post state.
   What happens to old `vienna` orders (keep them readable).
5. **Staff workflow**: a "Ship" list per collection day (what to pack, labels, mark as handed to post,
   optional tracking number); Agenda's "Pickups and deliveries" column; capacity check before promising.
6. **Customer copy** (German first, English): the range shown at checkout, on the thanks page, in e-mails
   and in Track ("Versand per Post · Zustellung voraussichtlich 2.–4. Dezember"). Follow
   `docs/reglas-aprendidas.md` (no filler, no promises we can't keep).
7. **Packaging risk** (glass/ceramic ornament breaking), parcel size/price assumptions — list what the
   owner must check with Post (real cost per parcel vs 5 €, collection service "Abholung", contract).
8. **Legal**: what changes in AGB/Widerruf/Datenschutz (shipping data shared with Post). Mark as
   "for the advisor"; do not write legal text.
9. Effort estimate split into backend / frontend / tests, and a list of **questions for the owner**.

Keep it concise (max ~2 pages + examples table).
