# Sustituir mocks por Spring

El swap está implementado y en producción con v3.1.0. La UI llama solo a `api` (`frontend/src/api/client.ts`); `VITE_DATA_SOURCE=mock` queda como valor predeterminado de desarrollo/demo y producción exige `http`. El cliente HTTP completo vive en `frontend/src/api/http/services.ts`.

## 1. Encender HTTP

En `frontend/.env`:

```
VITE_DATA_SOURCE=http
VITE_API_BASE_URL=http://localhost:8080
```

No hace falta tocar páginas. Vite usa el proxy `/api` local si no se especifica una base externa.

## 2. Contrato

Tipos en `frontend/src/domain/types.ts` (nombres alineados a FigJam Entities: `Customer`, `Order`, `OrderItem`, `Market`, `MarketDay`, `TimeBlock`, `StaffUser`).

Interfaces en `frontend/src/api/contracts.ts`; sus implementaciones mock y HTTP comparten ese contrato.

Auth: el staff ya guarda un token en `localStorage` (`awg-staff-token`) y `AuthContext` lo revalida con `api.auth.me`. En HTTP, manda `Authorization: Bearer <token>` en el helper de `fetch`.

## 3. Mapa implementado

Todos los cuerpos y respuestas tienen la forma de `frontend/src/domain/types.ts`. Errores: `{ status, message, code, field }` (código/campo según el error); `lib/apiError.ts` los traduce para la UI.

| Servicio UI | Endpoint | Auth |
|-------------|----------|------|
| `auth.login` / `me` / `logout` | `POST /api/staff/login`, `GET /api/staff/me`, `POST /api/staff/logout` | login público |
| `markets.*` | `GET /api/markets`, `GET /api/market-days[?marketId=]`, `POST /api/markets`, `DELETE /api/markets/{id}`, `DELETE /api/market-days/{id}` | staff |
| `agenda.*` | `GET /api/agenda/days`, `GET /api/agenda/days/{date}`, `PATCH /api/agenda/blocks/{itemId}`, `POST /api/agenda/capacity`, `POST /api/agenda/move-suggestion` (204 = ninguna) | staff |
| `agenda.makeRoomForBlock` / `makeRoom` | `POST /api/agenda/blocks/{itemId}/make-room`, `POST /api/agenda/make-room` | staff |
| `paintingDays.*` | `GET /api/painting-days?from=&to=`, `PATCH /api/painting-days/{date}` | staff |
| `marketStock.*` | `GET /api/market-stock`, `PATCH /api/market-stock/{id}`, `GET/PUT /api/market-stock/{id}/photo` | staff |
| `stats.get` | `GET /api/stats?from=&to=` | staff |
| `prices.*` | `GET/PUT /api/prices` | staff |
| `shipping.*` | `POST /api/shipping/window`, `GET /api/shipping/collection-days?from=&to=`, `PUT /api/shipping/collection-days/{date}` | staff |
| `orders.*` | `GET /api/orders/{id}`, `GET /api/orders` (filtros o `code=`), `GET /api/orders/{id}/bundle`, `POST /api/orders`, `PATCH /api/orders/{id}/items/{itemId}/status`, `PATCH/PUT /api/orders/{id}/handed-over`, `POST /api/orders/{id}/cancel` | staff |
| `payments.setPaymentState` | `PATCH /api/orders/{id}/payment-state` `{ state, method?, amountPaid? }` | staff |
| `payments.setPrice` | `PATCH /api/orders/{id}/price` `{ chargedTotal }` | staff |
| `orders.setSaleMarket` | `PATCH /api/orders/{id}/market` `{ marketDayId }` | staff |
| `tracking.getByCode` | `GET /api/track/{code}` | público; `X-Form-Token` cuando está disponible |
| `forms.getForm` / `submitForm` | `GET /api/forms/{token}`, `POST /api/forms/{token}` (multipart `payload` + `photo-{id}`) | público por token |
| fotos | `GET /api/photos/{id}` | público (id no adivinable) |
| `shop.*` | `GET /api/shop/config`, `POST /api/shop/pickup-days`, `POST /api/shop/shipping-quote`, `POST /api/shop/checkout`, webhook `POST /api/shop/stripe/webhook` | público |

Notas: no hay entidad `TimeBlock`; el bloque se deriva de `OrderItem.paintStart/paintEnd` y su `id` es el del ítem. La recogida en mercado conserva su `marketDayId` en el ítem. El bloque usa el puesto efectivo de pintura del día. `recordPayment` se eliminó del contrato: el staff marca estados.

## 4. Contratos de v3.1

- **Stock numerado.** New sale envía `marketOrnamentId` en el ítem de `POST /api/orders`. Una pieza vendida o sin pintar produce 409 `MARKET_STOCK_SOLD` o `MARKET_STOCK_NOT_READY`. El PATCH de stock usa `{ status, revision }`; el PUT de foto es multipart con `photo` (JPEG, máx. 5 MB) y `revision`. Vender desde Stock devuelve `MARKET_STOCK_SELL_IN_SALE`; una revisión obsoleta, 409 `MARKET_STOCK_CHANGED`. Cancelar la venta devuelve el adorno a `painted`.
- **Dos puestos.** `POST /api/orders` usa `soldOnMarketDayId` para la venta y `marketDayId` por ítem para la recogida. Cuando se solapan puestos se exige el día del puesto de venta. `GET /api/agenda/days` expone `markets` y `marketDays`. El PATCH de Painting days acepta `paintingMarketId` (omitir conserva, `null` quita la selección). El puesto efectivo es el elegido, el primario abierto o el que abra antes. Una recogida el mismo día de pintura en otro puesto, o cambiar el puesto dejando recogidas incompatibles, devuelve 409 `PAINT_NOT_AT_THIS_MARKET`. Capacidad y sugerencias reciben `handoffMarketDayId` y descartan esos huecos.
- **Recogida web.** `pickup-days` devuelve `marketDayId`, que el checkout manda con `deliveryDate` y `pickupTime`. En un solapamiento solo se ofrece el primario si abre ese día. Fecha o puesto inválidos → `PICKUP_DAY_INVALID`. Hora inválida → `PICKUP_TIME_INVALID`.
- **Post web.** `shipping-quote` recibe `{ items }` y devuelve `{ available, collectionDate, arrivalFrom, arrivalTo }` con fechas ISO o `null`. Sustituye a `delivery-dates`. En checkout, `deliveryKind: "post"` requiere dirección austríaca y `expectedArrivalTo`. El servidor recotiza bajo `ScheduleLock`: 409 `SHIPPING_UNAVAILABLE` o `SHIPPING_WINDOW_CHANGED` si no puede cumplir el rango. CP inválido → `POSTAL_INVALID`.
- **Post staff.** `shipping/window` recibe `{ readyOn }` y devuelve la forma de la cotización. `collection-days` devuelve `{ date, open, override }` para cada día de recogida o excepción del rango; el PUT recibe `{ open }` (`null` elimina la excepción). Prices añade `shippingFee` y `postCollectionDays`. La venta calcula en servidor la recogida y el rango. Con `awg.post.finished-with-custom` activo, enviar una pieza terminada exige una personalizada por Post en el mismo pedido (`SHIPPING_NEEDS_CUSTOM`).
- **Entrega y Track.** Post guarda la recogida en `handoffDate` y expone el rango `arrivalFrom`/`arrivalTo`. Handover acepta `{ handedOver, itemIds?, trackingNumber? }`. El pedido expone `trackingNumber` y `trackingUrl`; Track muestra el enlace de post.at cuando corresponde. `vienna` sigue disponible para leer entregas antiguas.
- **Make room.** El endpoint por ítem devuelve `{ moved }` y rechaza sesiones no elegibles (`SESSION_NOT_MOVABLE`) o sin hueco compatible (`NO_SLOT_KEEPS_PROMISE`). El endpoint del día recibe `{ date, minutes, marketDayId? }` y un `Idempotency-Key`, y devuelve `{ slot, moved }` o 409 `NO_MOVABLE_SESSION` con `reason`. Ambos mantienen las fechas de recogida/entrega y el rango de llegada. Ver [contrato de Post y Make room](../tasks/post-shipping-contract-2026-11-20.md) para las formas de los movimientos.

## 5. Fotos y Stripe

- Mock: `FileReader` → `dataUrl` en memoria.
- Real: `toPhoto` sigue leyendo el archivo en el navegador (vista previa); `submitForm`/`shop.checkout` suben los archivos en multipart. El backend detecta el tipo por bytes (JPEG/PNG/WebP/HEIC, máx. 10 MB), los guarda en `UPLOADS_DIR` y devuelve `/api/photos/{id}`.
- Pagos en el puesto: el staff verifica el cobro y marca el estado; la app no cobra. Pagos online: solo la tienda web, con Stripe Checkout (ver `docs/README.md`).

En HTTP el login oculta credenciales demo y «Reset demo data».

## Staff order and agenda details

- `orders.search(q)` → `GET /api/orders/search?q=…`; `orders.attention()` → `GET /api/orders/attention`. Both return `OrderSummary[]`: id, code, customerName, phone, createdAt, paymentState, checkoutStatus (lowercase/null), total, items (count), nextHandoffDate, handedOver and `needsReview`.
- Attention lists, newest first, paid web orders not yet reviewed (`needsReview: true`), then web checkouts still `pending` or in `review`. `orders.markReviewed(id)` → `POST /api/orders/{id}/reviewed` (staff) sets `reviewedAt` once and returns the `Order`; repeating it keeps the first time. Stall sales are created already reviewed. `Order` carries `needsReview` and `reviewedAt`.
- `forms.submitForm` and `shop.checkout` accept an optional `locale` (`de`/`en`) for customer e-mails; German when missing.
- **Back-name limit (V20).** `Prices.backNameMax` (1–20, default 5) is edited on Stock; the PUT field is optional and `null` keeps the saved limit. `ShopConfig.backNameMax` exposes it to `/buy` and `/form/:token`. Shop checkout and the QR form reject a longer name with `400 VALIDATION` on `items[n].backName`; the QR form accepts a name already saved on the order unchanged, so orders taken under an older limit stay valid. Clients fall back to 5 when the field is missing.
- **Ornament size (V21, 2026-11-26).** Every custom ornament is `size: 'big'` (10 cm) or `'medium'` (8 cm). `CreateSaleItemInput.size` and `ShopItemInput.size` are required for custom items (`400 VALIDATION` on `items[n].size`) and ignored for finished pieces. `OrderItem`, `TrackItemView` and `AgendaDelivery` return `size` (null for finished pieces; custom items sold before V21 were migrated to `big`). `customPrice` is the big price and the new `customMediumPrice` the medium one, in `Prices`, `PricesUpdate` (required) and `ShopConfig`. Item cost = size price + name surcharge.
- **Sale market (2026-11-26, no migration).** `Order.soldOnMarketDayId` / `soldAtMarketName` say which stall a stall sale counts for (from `order_item.sold_on_day_id`; null for web orders or a sale made when no stall was open). `PATCH /api/orders/{id}/market` moves a stall sale to another market: the day must be a `market` (not `home`) day on the sale's own Vienna date, else `400 VALIDATION` on `marketDayId`; web orders give `409 WEB_ORDER_MARKET`. It sets the sold-on day of every item and moves the handoff day of finished pieces handed over at the sale; custom pickups and painting are untouched. Why: on 26 Nov 2026 the first sales were made before the real market was loaded, and the only fix was SQL by hand.
- **Base stock per size (V22, 2026-11-26).** `InventoryItem.size` is `'big' | 'medium'` for custom rows (null for the finished row) and each colour/finish has one row per size. `ShopConfig.colors[]` carries `size` too, so `inStock` is per size, colour and finish. A sale or checkout deducts the row of the chosen size; `409 OUT_OF_STOCK` names the size. V22 marks existing rows big and adds medium rows at 0.
- `ShopConfig.finishedPrice` joins customPrice/nameExtra. Staff must have all three finite server prices before creating a sale; there is no client price fallback. The shop still sells custom ornaments only.
- Order/bundle responses add lowercase `checkoutStatus` and `source` (`web`/`stall`). PENDING disables manual collection; PENDING/REVIEW disable painting actions.
- `AgendaSlot` adds `held` and nullable `holdUntil` (ISO instant). A held slot has `order/item/customer = null`; REVIEW holds have no expiry promise. Keep held blocks in overlap/capacity geometry.
- `AgendaDelivery` adds `remaining` and `paymentState`. The balance uses amountPaid, including deposits that differ from 50%. UI confirms before handing over a balance-due order and re-reads the bundle before handover.
- Staff HTTP mutations dispatch a data-change event after a successful response; readers also refetch on focus/visibility and every minute. HTTP 401 emits a session event; the router keeps `next` and the draft, without a full reload. Offline bootstrap retains the token.
- New stall dates with Vienna deliveries retain 400 `DAY_HAS_DELIVERIES`, field `days`; the mock follows the same rejection. Painted custom bases are not returned to stock on cancellation.

Payment and handover are separate server operations. If payment succeeds and handover fails, retry handover on the paid order.

## Staff sales list (2026-11-06)

- `orders.listSales(filters)` → staff-authenticated `GET /api/orders` without the `code` parameter. Optional filters: `state=unpaid|deposit|paid|pending|review`, `source=stall|web`, `market=<market id>` (2026-11-27: stall sales with at least one ornament sold on a day of that market, by `soldOnDay`), `from`/`to` calendar dates, `query` (code, customer name or at least three phone digits), zero-based `page` and `size` (default 20, maximum 50).
- The response is `{ orders: OrderSummary[], page, size, totalElements, totalPages, received }`, ordered by creation time and id descending. `from` and `to` include the whole selected calendar days in Europe/Vienna. Filters apply before pagination. A pending/review checkout has that displayed state and is excluded from `state=unpaid`.
- Summaries include `source` (`stall` for legacy null sources), `status` (`ACTIVE`/`CANCELLED`) and nullable `soldAtMarketName`, read from the selling market day. Sales results also include `saleItems` with the item ID, kind, colour, first reference photo URL and numbered ornament ID where present. Cancelled sales remain visible and erased orders are omitted, as in staff search.
- `received` (2026-11-27) is `{ card, cash, other, due }`: the money actually received (`amountPaid`) over **every page** of the current filters, split by `paymentMethod`. Cancelled orders and web checkouts still pending/review are left out; `other` holds old paid orders with no method recorded (the UI shows it only when it is above 0); `due` is total minus received on those same sales (deposits and unpaid), never negative. Computed in `OrderService.listSales` with the same Specification as the list, so the totals always match what the filters show.
- `/staff/sales` provides Today / 7 days / All, payment/source/market filters, a Card | Cash totals strip for the range and filters, and a link to each order. The staff header handles interactive search. Sales still accepts `q` in the URL, and filter and page parameters survive the return from order detail. These fields use existing records and require no migration.


### Per-day painting hours (v1.1)

`GET /api/painting-days?from=&to=` returns effective numeric `openHour` / `closeHour` with the existing date/open/maxPaintings/booked fields. Staff PATCH accepts both optional hour values together, in quarter-hour steps from 00:00 through 23:45, end after start. Omitting both preserves any override. V11 stores nullable overrides; unset dates inherit the preferred market/home painting window. These values never modify market pickup times. Existing bookings remain when the owner narrows a window or capacity. Automatic suggestions, manual sales and moves use the painting hours; manual bookings retain the existing ability to exceed the daily count/closed suggestion limit. Agenda derives its board extent from the effective window plus all existing slots.

Marking an item `finished` releases its future painting time. On the painting date it can also shorten the recorded session to Vienna time rounded up to the quarter-hour. Completion before the start records a 15-minute session ending at that time. The daily `booked` count tracks active sessions. Reopening keeps the recorded interval and fails with 409 if another session already occupies the remaining time.

### Item handover, cancellation and QR receipt (v1.1)

- `PATCH /api/orders/{id}/handed-over` accepts `{ handedOver, itemIds? }`; omitted IDs retain the whole-order operation. V8 adds per-item handover; the order completes when the last item is handed over. Deliveries keeps one complete cart across dates, destinations and partial handovers. Date, destination and production filters select matching items for enabled controls and default batch selection; other cart items stay visible. Balance collection remains order-wide.
- `POST /api/orders/{id}/cancel` retains the order and optional reason (V9), returns eligible stock and excludes its reservations. V10 adds a maximum of two pending checkouts per client-IP hash (`request.getRemoteAddr()`), with 15-minute application reservations; exceeding the cap returns `PENDING_CHECKOUT_LIMIT`. V8–V11 are already applied in production and are preserved byte-for-byte from `release/v1.1`; invoice schema changes now use V12. Production runs Flyway V1–V17.
- The waiting QR sale reads the existing `GET /api/orders/{id}/bundle` serially, at 5-second intervals; failures back off to 10/20/30 seconds. It stops once all custom items have `formComplete`, shows **Form received**, and provides order details. Focus/visibility can refresh. No new receipt endpoint or sent-notification claim is involved.
- A successful public form submit goes directly to Track with a focused saved notice and bypasses the decorative wipe. The Track reading card stays opaque throughout its entrance.

## Legacy Vienna delivery and SMTP

`GET /api/shop/config` adds `deliveryWindowStart: "18:00"` and `deliveryWindowEnd: "20:00"` (configurable `HH:mm`, Europe/Vienna). `GET /api/track/{code}` → `when`, and `GET /api/forms/{token}` → each `handoffs` entry, expose Vienna delivery as `{ kind: "vienna", date, fromHour: 18, toHour: 20, marketName: null, untilHour: null }`. Existing fields and the `vienna` discriminator stay compatible; market pickup `fromHour`/`untilHour` retain their meaning, and `toHour` is null/absent there. TypeScript fields added for older-server compatibility are optional. HTTP methods pass JSON through with no adapter changes; mock config/Track/form return the same new fields. This window applies to legacy Vienna deliveries.

`GET /api/shop/config` also returns `confirmationEmail` (boolean): true only when SMTP (`MAIL_HOST` + `awg.mail.from`) is configured. The thanks page shows "Ich habe dir eine E-Mail mit deinem Bestellcode geschickt…" only then. Without seller data the e-mail is a payment confirmation (subject "Danke für deine Bestellung · Code …"), never an invoice.

Invoices use `V12__invoices.sql`. They run entirely behind existing payment/handover endpoints; no new public endpoint or sensitive invoice data appears in Track. See `contracts-and-dtos.md` and `deploy.md` for numbering, mail retries and seller configuration.


## Public form compatibility

The current public UI remains the three-screen flow (Design → Delivery/contact → Review), with one page per ornament, tile picker, optional paid back name and no separate pet-name field or mobile design substeps. `petName` is optional; a paid back name also supplies it. The API retains existing legacy fields. Track consumes cancellation and per-item handover data while retaining the newer public layout. The public Track UI offers a lookup only. The legacy address PATCH is still in the backend with form-token authorization.

`GET /api/track/{code}` adds `discount` (2026-11-27): the stall discount in euros (`0` when none). Item `cost` stays the list price and `total` is what was charged, so Track shows a «Rabatt» line. Optional in TypeScript for older servers.
