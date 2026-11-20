# Design Proposal: Replace Vienna Hand Delivery with Austrian Post Shipping (2026-11-20)

**Status:** Read-only design proposal · **Target branch:** `release/v3.1` · **Next Flyway version:** `V17__post_shipping.sql`

---

## 1. Deterministic Date-Range Algorithm (`Europe/Vienna`)

### Pure function contract
```text
planPostShipment(orderDate, itemDurations, agendaSnapshot, postConfig)
  → { paintSlots, readyDate, collectionDate, deliveryStart, deliveryEnd } | null
```

1. **Working-day definition (`isWorkingDay(d)`):**
   - `d.getDayOfWeek()` is Monday–Friday (`1..5`), **and**
   - `d` is not an Austrian public holiday (`2026-11-01` Allerheiligen, `2026-12-08` Mariä Empfängnis, `2026-12-25` Christtag, `2026-12-26` Stefanitag; configurable in `awg.shop.post-holidays`).
   - *Note on 24 Dec (Heiligabend):* In Austria, 24 Dec is a statutory half/collective-agreement day on which Österreichische Post still delivers morning parcels. We treat `2026-12-24` as a valid **delivery** day (`lastArrivalDate = seasonEnd = 2026-12-24`), never as a collection day.
2. **Earliest paint slots & `readyDate`:**
   - Sort custom items longest duration first (`1.25h` with name, `1.0h` without, or staff preset).
   - Start search at `notBefore = orderDate.plusDays(Math.max(1, leadDays))` (in New sale, if all items are `finished`, `paintSlots = []` and `readyDate = orderDate`).
   - Greedily place each custom item on the earliest open painting day `d >= notBefore` where `agendaService.findFreeSlot(snapshot, d, duration, ...)` succeeds (respecting `PaintingDay.open`, `maxPaintingsFromHours`, and existing + draft busy blocks).
   - `readyDate = max(slot.date for slot in paintSlots)` (or `orderDate` for finished-only stall orders).
3. **Next Post collection day (`collectionDate`):**
   - Must be **strictly after** `readyDate` (`c >= readyDate.plusDays(1)`) and `c >= deliveriesFrom` (`2026-11-30`), so every ornament is painted, dry, and boxed before the Post collection window.
   - `isCollectionDay(c)` is true when `isWorkingDay(c)` **and**:
     - `post_collection_day` has an explicit override `open = true` on `c`, **or**
     - `c.getDayOfWeek()` is in `awg.shop.post-collection-weekdays` (default `TUESDAY, FRIDAY`) and not overridden with `open = false`.
   - *Holiday on a collection weekday (e.g. Tue 8 Dec):* because `isWorkingDay(2026-12-08) == false`, Tue 8 Dec is never selected; the algorithm advances to the next open collection day (Fri 11 Dec by default, or Wed 9 Dec if staff enables Wed 9 Dec as an extra collection day).
4. **Delivery window (`deliveryStart..deliveryEnd`):**
   - `deliveryStart = addWorkingDays(collectionDate, transitMinDays)` (default `N = 2`).
   - `deliveryEnd   = addWorkingDays(collectionDate, transitMaxDays)` (default `M = 3`).
5. **Christmas cut-off (`deliveryEnd <= seasonEnd`):**
   - If `deliveryEnd.isAfter(seasonEnd)` (`2026-12-24`), return `null` (shipping unavailable).
   - **Last collection day for Christmas 2026:**
     - With fixed **Tue + Fri** only: **Fri 18 Dec** (`+2..3` working days = **Tue 22 – Wed 23 Dec**). A collection on Tue 22 Dec would yield **Thu 24 – Mon 28 Dec** (`deliveryEnd = 28 Dec > 24 Dec`, rejected because Fri 25 & Sat 26 Dec are holidays).
     - Therefore, under fixed Tue + Fri, painting must finish by **Thu 17 Dec**, making **Wed 16 Dec 2026** the **last order date** (assuming Thu 17 Dec still has free painting capacity; earlier if Thu 17 Dec fills up).
     - If staff enables an **extra collection day on Mon 21 Dec**, collection on Mon 21 Dec yields **Wed 23 – Thu 24 Dec**, extending `readyDate` to **Sun 20 Dec** and the **last order date** to **Sat 19 Dec 2026**.
   - **Enforcement:**
     - **Web shop (`/buy`):** replace `POST /api/shop/delivery-dates` with `POST /api/shop/shipping-quote` (or return `{ available, collectionDate, deliveryStart, deliveryEnd }`). When `available == false`, the "Versand per Post" card in `/buy` is disabled with a clear notice; "Abholung am Markt" remains selectable as long as market pickup days have capacity. If neither is available, `/buy` shows no available handoff options. At `POST /api/shop/checkout`, the server re-runs `planPostShipment` under `ScheduleLock` and rejects with `409 SHIPPING_CUTOFF_PASSED` if capacity shifted past 24 Dec.
     - **Staff New sale:** in `DeliveryCard`, when `Post` is selected, the planner computes the earliest paint slot(s) and the resulting `collectionDate` + `deliveryStart..deliveryEnd`. If `deliveryEnd > 2026-12-24`, the Post option is disabled (`"Arrives after 24 Dec — choose market pickup"`), and `OrderService.createSale` enforces `deliveryEnd <= seasonEnd` server-side.

### Worked Examples (2026 Calendar · Default Tue/Fri Collection · +2..3 Working Days)

*(Assumes free painting capacity on `orderDate + 1`)*

| Order date | Earliest paint slot (`readyDate`) | Next Post collection day | Delivery range (`+2..3` working days) | Christmas cut-off (`<= 24 Dec`) |
|---|---|---|---|---|
| **Sat 28 Nov 2026** | **Sun 29 Nov** (10:00–11:00) | **Tue 1 Dec** *(first Tue >= 30 Nov)* | **Thu 3 – Fri 4 Dec 2026** *(+1 Wed 2, +2 Thu 3, +3 Fri 4)*¹ | **Allowed** |
| **Sat 5 Dec 2026** *(holiday test)* | **Sun 6 Dec** (10:00–11:00) | **Fri 11 Dec** *(Tue 8 Dec is Mariä Empfängnis; or **Wed 9 Dec** if staff adds extra day)* | **Tue 15 – Wed 16 Dec** *(or **Fri 11 – Mon 14 Dec** if collected Wed 9 Dec)* | **Allowed** |
| **Wed 9 Dec 2026** | **Thu 10 Dec** (10:00–11:00) | **Fri 11 Dec** | **Tue 15 – Wed 16 Dec 2026** *(+1 Mon 14, +2 Tue 15, +3 Wed 16)* | **Allowed** |
| **Wed 16 Dec 2026** *(last Tue/Fri cutoff)* | **Thu 17 Dec** (10:00–11:00) | **Fri 18 Dec** | **Tue 22 – Wed 23 Dec 2026** *(+1 Mon 21, +2 Tue 22, +3 Wed 23)* | **Allowed** (last order date for fixed Tue/Fri) |
| **Thu 17 Dec 2026** | **Fri 18 Dec** (10:00–11:00) | **Tue 22 Dec** *(misses Fri 18 Dec collection; or **Mon 21 Dec** if extra day added)* | **Thu 24 – Mon 28 Dec** *(fixed Tue/Fri)* / **Wed 23 – Thu 24 Dec** *(with Mon 21 Dec extra collection)* | **Rejected** under fixed Tue/Fri (`28 Dec > 24 Dec`); **Allowed** only if Mon 21 Dec collection is enabled |
| **Sun 20 Dec 2026** | **Mon 21 Dec** (10:00–11:00) | **Tue 22 Dec** | **Thu 24 – Mon 28 Dec 2026** *(Fri 25 & Sat 26 Dec are holidays)* | **Rejected** (shipping disabled; market pickup only) |

¹ *Calendar note:* On the 2026 calendar, 1 Dec is Tuesday and 2 Dec is Wednesday. If collection is Tue 1 Dec, +2..3 working days is Thu 3 – Fri 4 Dec (a range of Tue 2 – Thu 4 Dec would only occur in a year where 2 Dec is Tuesday or if +1..3 working days were used).

---

## 2. Collection Days ("1 or 2 per week depending on volume")

Keep the rule **deterministic for customers** and **one-tap adjustable for staff**:
- **Automatic baseline:** Configure fixed default collection weekdays in `awg.shop.post-collection-weekdays` (recommended default: **Friday** as the guaranteed weekly collection day, or **Tuesday + Friday**). The customer promise at checkout is always computed from the currently active collection schedule so we never promise an early range that depends on unbooked future volume.
- **Manual override by staff:** Add a small `post_collection_day (date PRIMARY KEY, open BOOLEAN)` table (or toggle in `/staff/deliveries` and Agenda header: *"Post collection day · Add extra collection on Tue"*).
  - If default is **1 day/week (Friday)** and volume is high (e.g. `>= 5` parcels waiting by Monday), staff taps **"Add Post collection on Tuesday"** in Deliveries; new orders immediately see the Tuesday collection window, and existing finished parcels can be packed early.
  - Conversely, if default is **2 days/week (Tue + Fri)**, every customer automatically gets the shorter waiting time, and Gaby simply requests Post collection on Tue/Fri whenever at least 1 parcel is scheduled for that day (if 0 parcels are scheduled for Tuesday, she skips booking Post that day with zero customer impact). **Recommendation:** Default to **Tuesday + Friday** in config, plus a manual extra-day toggle (especially for **Mon 21 Dec** before Christmas).

---

## 3. Address Scope, Postcode Validation & 5 € Shipping Fee

- **Address scope (recommended: all of Austria, `AT`):**
  - Since Österreichische Post charges a single domestic parcel rate across Austria and takes 2–3 working days nationwide, restricting shipping to Vienna (1010–1230) is no longer necessary.
  - **Postcode validation:** Replace `ViennaAddress.isViennaPostal` (`^1(0[1-9]|1[0-9]|2[0-3])0$`) with Austrian 4-digit postcodes `^[1-9]\d{3}$` (`1010`–`9992`), and make the **City** (`Ort`) field editable in `ContactFields.tsx` (defaulting to empty or auto-filled if `1010–1230 → Wien`, instead of the read-only `Wien` span).
  - **No EU/international shipping in v3.1:** International post near Christmas has longer transit times (5–10 working days), higher tariffs (10–15 €), and customs/packaging complexity. Keep country fixed to **Österreich / Austria** (shown as a static label or `(?)` help tip: *"Versand innerhalb Österreichs"*).
- **Shipping fee (5,00 € editable in Stock):**
  - Add `shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 5.00` to `price_setting` (fallback `awg.pricing.shipping-fee=5.00`, replacing `awg.shop.delivery-fee`).
  - Expose `"Shipping by post"` in `/staff/inventory` (`PricesCard` in `InventoryPage.tsx`) alongside Custom, Finished, and Name extra (`0.00` to `999.99`, guarded by `expectedRevision` and `ScheduleLock`).
  - **Applies to both `/buy` and staff New sale:** When an order in `/buy` or New sale has at least one `post` item, `order.deliveryFee` is set to the current `shippingFee` (5,00 €) once per order and added to `order.total`. (If a stall order has multiple ornaments shipped together to one address, the 5 € fee is charged once on `Order`).

---

## 4. Data Model & Flyway Migration (`V17__post_shipping.sql`)

- **Keep old `vienna` (`DELIVERY`) orders 100% readable:** Do **not** rewrite existing `DELIVERY` rows. Add a new enum constant `POST` (`@JsonProperty("post")`) to `DeliveryKind` alongside `MARKET` and legacy `DELIVERY` (`"vienna"`).
  - Existing `"vienna"` orders continue to render as `"Lieferung in Wien · 18–20 Uhr"` in Track, invoices, and Order detail.
  - New orders only offer `market` and `post`.
- **Where shipping fields live:**
  - `Order`: keeps `delivery_address` (`line1`, `line2`, `city`, `postal_code`) and `delivery_fee` (`NUMERIC(10,2)`). Add optional `tracking_number VARCHAR(64)` and `shipped_at TIMESTAMP(6) WITH TIME ZONE` on `orders` (one parcel per order).
  - `OrderItem`:
    - `delivery_kind = 'POST'`
    - `handoff_date` = planned **Post collection date** (`collectionDate`, `LocalDate`) — this is the deadline day for Gaby to have the ornament painted, packed, and handed to the Post, so `AgendaService` and `DeliveriesPage` naturally group items by collection day!
    - `delivery_start_date DATE` and `delivery_end_date DATE` = the promised 2–3 working-day arrival window (`deliveryStart..deliveryEnd`).
    - `handed_over` = true once handed to the Post (setting all items `handed_over = true` marks `order.handedOver = true`, `order.handedOverAt = now`, `order.shippedAt = now`, and starts the 30/60-day GDPR retention clock).
- **Migration `V17__post_shipping.sql`:**
  ```sql
  ALTER TABLE price_setting ADD COLUMN shipping_fee NUMERIC(10,2) NOT NULL DEFAULT 5.00;
  ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(64);
  ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMP(6) WITH TIME ZONE;
  ALTER TABLE order_item ADD COLUMN delivery_start_date DATE;
  ALTER TABLE order_item ADD COLUMN delivery_end_date DATE;
  CREATE TABLE post_collection_day (
      date DATE PRIMARY KEY,
      open BOOLEAN NOT NULL
  );
  ```
- **Data retention (`RetentionService`):** Clear `order.trackingNumber` at the same time `deliveryAddress` and personal data are anonymized (60 days after `handedOverAt`).

---

## 5. Staff Workflow (New Sale, Agenda & Deliveries / "Ship" List)

- **New sale (`/staff/sales/new`):**
  - Replace `"Delivery"` (`mode: 'vienna'`) in `SegmentedControl` with **`"Post (+€5)"`** (`mode: 'post'`).
  - Instead of asking the staff member to pick a Wed/Fri delivery day, selecting **Post** automatically plans the earliest free painting slot(s) (or lets staff place the paint block on the board) and displays the computed summary:
    `Post collection Tue 1 Dec · Estimated delivery Thu 3 – Fri 4 Dec · +€5.00 shipping`.
  - How the address is collected at the stall:
    - **Custom ornaments:** collected via the customer QR form (`/form/:token`), where `needsAddress` is true whenever any item has `deliveryKind == POST`.
    - **Finished-only ornaments shipped by post:** when an order has only finished ornaments and mode `post`, New sale either shows the QR form (`needsAddress`) or an inline address form before payment so the parcel never lacks an address.
- **Agenda (`/staff/agenda`):**
  - In the right-hand **"Pickups and deliveries"** column, replace `"Home deliveries"` / `"Open delivery run"` with **"Post collection"** (`X parcels to hand to Post`) on collection days, linking to `/staff/deliveries?day=YYYY-MM-DD&kind=post`.
  - Block compact label on calendar slots: `Post Tue 1 Dec` (collection day) instead of `Vienna Wed 18–20`.
- **Deliveries / "Ship" list (`/staff/deliveries`):**
  - Filter `Handoff`: `All · Market · Post` (plus legacy `Vienna` only if any unhanded legacy row exists).
  - Replace `"Open delivery run"` (which sorted by Vienna district) with **"Pack & ship list"** for the selected collection day:
    - Shows each order card with: **what to pack** (photo, colour/finish, back name), **full formatted postal address** with a one-tap **"Copy address"** button (for pasting into Post online label / Paketmarke), **payment status** (blocks shipping if unpaid/balance due, with warning), and an optional **"Tracking number"** input (`trackingNumber`).
    - Primary action per order: **"Mark handed to Post"** (reuses `useHandover` checklist + optional tracking number field → sets `handedOver = true`, `shippedAt = now`, triggers customer notification).

---

## 6. Customer Copy (DE First, EN Second)

Follows `docs/reglas-aprendidas.md` §1: concise, no filler, no false promises ("voraussichtlich" / "estimated", never an exact day or hour, no `.ics` calendar button for a multi-day postal window).

| Surface | German (`de`, default) | English (`en-GB`) |
|---|---|---|
| **`/buy` Step 2 — Method card** | **Versand per Post** · Zustellung in Österreich · +{fee} | **Shipping by post** · Delivery in Austria · +{fee} |
| **`/buy` Step 2 — Range box** *(replaces calendar)* | **Voraussichtliche Zustellung** · {range} *(e.g. `Do, 3. – Fr, 4. Dez.`)* · Versand mit der Österreichischen Post | **Estimated delivery** · {range} *(e.g. `Thu 3 – Fri 4 Dec`)* · Sent with Austrian Post |
| **`/buy` Step 2 — Cut-off reached** | Vor Weihnachten ist kein Postversand mehr möglich. Wähle die Abholung am Markt. | Postal delivery can no longer arrive before Christmas. Choose market pickup. |
| **`/buy` Step 3 — Review card & Cart** | Card title: **Versand per Post** · Row: *Zustellung* → `voraussichtlich 3.–4. Dezember` · Cart row: *Versand* → `5,00 €` | Card title: **Shipping by post** · Row: *Delivery* → `estimated 3–4 December` · Cart row: *Shipping* → `€5.00` |
| **`/buy/thanks` — Timeline step 3** | **Versand per Post** · `Zustellung voraussichtlich 3.–4. Dezember` *(hide `.ics` button for `post`; keep it for `market`)* | **Shipping by post** · `Estimated delivery 3–4 December` |
| **`/track/:code` — When fact & Chip** | Status chip when `handedOver`: **Versendet** · Fact *Wann*: `Versand per Post` / `Zustellung voraussichtlich 3.–4. Dezember` (+ `Sendungsnummer: {tracking}` if entered) | Status chip when `handedOver`: **Shipped** · Fact *When*: `Shipping by post` / `Estimated delivery 3–4 December` (+ `Tracking number: {tracking}` if entered) |
| **Invoice / Zahlungsbestätigung & E-mails** | Item line: `Versand per Post: Zustellung voraussichtlich 03.12.–04.12.2026` · Fee line: `Versandkosten: 5,00 EUR` · Handed-over mail: `Deine Bestellung wurde an die Österreichische Post übergeben` (+ Sendungsnummer if present) | Item line: `Shipping by post: estimated delivery 03.12.–04.12.2026` · Fee line: `Shipping fee: 5.00 EUR` · Handed-over mail: `Your order has been handed over to Austrian Post` (+ tracking number if present) |

*Date-range formatter (`lib/shippingWindow.ts`):* Same month → `3.–4. Dezember 2026` (DE) / `3–4 December 2026` (EN); cross-month → `30. November – 2. Dezember 2026` / `30 November – 2 December 2026`.

---

## 7. Packaging Risk & Austrian Post Checklist for the Owner

Hand-painted baubles (especially glass/ceramic) face drop and crush forces on automated parcel sorters (~80 cm belt drops). Before enabling Post shipping, the owner should verify:

1. **Breakage protection (double-wall / suspension):**
   - Wrap the ornament in tissue paper + bubble wrap (at least 3 cm cushioning on all sides) inside its gift box, then place the gift box inside a rigid **corrugated outer shipping carton** (e.g. `15 × 15 × 15 cm` or `20 × 15 × 10 cm`) with void fill so the inner box cannot shift. ("Fragile" stickers alone are not read by sorting machines.)
   - **Multi-ornament orders:** Verify carton sizes for 2–4 ornaments in one order so they do not knock against each other.
2. **Real Post tariff vs. 5,00 € fee:**
   - Because an ornament (~8 cm diameter) + cushioning exceeds the 3 cm height limit of a letter/*Päckchen S*, it must travel as a **Paket** (with tracking and insurance up to 510 €).
   - Check Österreichische Post online **Paketmarke** rates (typically ~4,80 €–5,30 € online for Paket S up to 2 kg, plus ~0,60 €–1,00 € for the shipping carton and padding). Decide whether 5,00 € is a subsidised flat rate for the customer or if it should be adjusted in Stock.
3. **Collection service ("Abholung"):**
   - Verify how parcels are collected: **Post Abholservice** (on-demand pickup booked online per collection day, or business contract *Post.at Business*) vs. dropping pre-labelled *Paketmarke* parcels at a nearby Postfiliale / Post-Empfangsbox.
   - Check the **booking cut-off time** (usually the evening before or morning of collection) and **collection time window** (so Gaby knows if she can be at a market stall on a collection day or if collection must happen on home-painting mornings).

---

## 8. Legal Impact (For the Legal Advisor — Do Not Invent Legal Text)

All changes in `frontend/src/content/legal.ts` must be reviewed by the legal advisor before publishing:
1. **AGB (`terms`):**
   - *Preise und Bestellung:* Update delivery cost from `"derzeit 0 €"` to the shipping fee (`5,00 €`, or reference the shipping cost displayed at checkout).
   - *Lieferung und Marktstand:* Replace `"liefert nur innerhalb Wiens (Postleitzahlen 1010–1230), an verfügbaren Mittwochen und Freitagen"` with postal shipping via Österreichische Post (delivery area: Austria / Vienna, estimated delivery window in working days, Christmas order cut-off).
2. **Widerruf (`terms` — § 18 Abs. 1 Z 3 FAGG):**
   - Custom ornaments remain exempt under § 18 Abs. 1 Z 3 FAGG.
   - **Advisor check:** If a customer orders a **non-personalised (`finished`) ornament at the stall with postal shipping**, verify whether it remains an on-premises stall contract (*Geschäftsraummarktstand*) or if any distance-selling / shipping risk-of-loss rule (§ 7b KSchG: risk passes to consumer upon handover by Post) needs to be stated in the AGB.
3. **Datenschutz (`privacy`):**
   - *Zahlung und Dienstleister (Recipients under Art. 13(1)(e) GDPR):* Add **Österreichische Post AG** as a recipient of delivery data (`Name`, `Lieferadresse`, and—if entered on the digital Paketmarke for parcel notifications—`E-Mail-Adresse` / `Telefonnummer`) on the basis of contract performance (Art. 6(1)(b) GDPR).
   - *Speicherdauer:* Note that tracking numbers (`Sendungsnummern`) are deleted together with the delivery address after the retention period.

---

## 9. Effort Estimate & Open Questions for the Owner

### Effort Estimate
- **Backend (~1 day):** `V17__post_shipping.sql`; `DeliveryKind.POST`; `PriceSetting.shippingFee` + `PricingService`; pure `PostShippingPlanner` (working days, Austrian holidays, configurable collection weekdays + `post_collection_day` overrides, `N..M` transit range, 24 Dec cutoff); update `ShopService` (quote + checkout + Stripe line `"Shipping by post"`), `OrderService.createSale` (shipping fee + range + finished-with-post address), `AgendaService`, `TrackingService`, `InvoiceRenderer`, `NotificationService`, `RetentionService`.
- **Frontend (~1.5 days):**
  - Public: `/buy` Step 2 (replace calendar with computed delivery-range card for `post`; update `ContactFields` postcode validation & editable City), Step 3 Review, `/buy/thanks` (hide `.ics` for `post`), `/form/:token` (`needsAddress` for `post`), `/track/:code` (`Versendet` / range / tracking number), `lib/shippingWindow.ts`, DE/EN keys in `LocaleContext.tsx`.
  - Staff: `/staff/inventory` (`shippingFee` field in `PricesCard`), `/staff/sales/new` (`Post (+€5)` mode with auto-calculated collection & delivery range), `/staff/deliveries` (Pack & ship view, copy address, optional tracking number, extra collection day toggle), `/staff/agenda` & `/staff/orders/:id`.
- **Tests (~1 day):**
  - Backend unit & integration tests for `PostShippingPlanner` (all 2026 dates, 8 Dec holiday, 24 Dec cutoff, capacity interaction, `V17` migration, price settings).
  - Frontend Node tests (`shippingWindow.test.mjs`) + Playwright E2E updates (`buy`, `form`, `track`, `staff-sale`, `staff-deliveries`) + visual snapshots (`a11y-visual`) at 360 px and 1280 px.

### Questions for the Owner
1. **Delivery area:** Should postal shipping be open to **all of Austria** (4-digit postcode `1000–9999` + editable city field), or still restricted to **Vienna (`1010–1230`)**?
2. **Default collection weekdays:** Which fixed weekday(s) should be configured by default — **Tuesday + Friday** (2 days/week), or **Friday only** (1 day/week) with staff toggling Tuesday on when volume is high?
3. **Holiday collection on Tue 8 Dec (Mariä Empfängnis):** Should parcels ready between 6–8 Dec wait for **Fri 11 Dec**, or automatically shift collection to **Wed 9 Dec**?
4. **Christmas Eve (Thu 24 Dec) arrival & Mon 21 Dec collection:** Do you accept **Thu 24 Dec** as the last valid arrival date (if we add an extra collection on **Mon 21 Dec**, last order date is **Sat 19 Dec**), or should the last promised arrival date be **Wed 23 Dec** (collection **Fri 18 Dec**, last order date **Wed 16 Dec**)?
5. **Finished ornaments at the stall:** In New sale, can staff also ship a **ready-made (`finished`) ornament** by Post (+5 €), and if so, should the customer enter their address via the QR form just like a custom order?
