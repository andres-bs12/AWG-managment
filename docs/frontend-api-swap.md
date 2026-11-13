# Sustituir mocks por Spring

El swap está implementado. La UI llama solo a `api` (`frontend/src/api/client.ts`); `VITE_DATA_SOURCE=mock` queda como valor predeterminado de desarrollo/demo y producción exige `http`. El cliente HTTP completo vive en `frontend/src/api/http/services.ts`.

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
| `orders.*` | `GET /api/orders/{id}`, `GET /api/orders?code=`, `GET /api/orders/{id}/bundle`, `POST /api/orders`, `PATCH /api/orders/{id}/items/{itemId}/status`, `PATCH /api/orders/{id}/handed-over` | staff |
| `payments.setPaymentState` | `PATCH /api/orders/{id}/payment-state` `{ state, method? }` | staff |
| `tracking.getByCode` / `updateViennaAddress` | `GET /api/track/{code}`, `PATCH /api/track/{code}/address` | público; la dirección solo con `X-Form-Token` |
| `forms.getForm` / `submitForm` | `GET /api/forms/{token}`, `POST /api/forms/{token}` (multipart `payload` + `photo-{id}`) | público por token |
| fotos | `GET /api/photos/{id}` | público (id no adivinable) |
| `shop.*` | `GET /api/shop/config`, `POST /api/shop/delivery-dates`, `POST /api/shop/checkout`, webhook `POST /api/shop/stripe/webhook` | público |

Notas: no hay entidad `TimeBlock`; el bloque se deriva de `OrderItem.paintStart/paintEnd` y su `id` es el del ítem. `marketDayId` de entrega/bloque se resuelve por fecha (gana el puesto sobre casa). `recordPayment` se eliminó del contrato: el staff marca estados.

## 4. Fotos y Stripe

- Mock: `FileReader` → `dataUrl` en memoria.
- Real: `toPhoto` sigue leyendo el archivo en el navegador (vista previa); `submitForm`/`shop.checkout` suben los archivos en multipart. El backend detecta el tipo por bytes (JPEG/PNG/WebP/HEIC, máx. 10 MB), los guarda en `UPLOADS_DIR` y devuelve `/api/photos/{id}`.
- Pagos en el puesto: el staff verifica el cobro y marca el estado; la app no cobra. Pagos online: solo la tienda web, con Stripe Checkout (ver `docs/README.md`).

## 5. Checklist de swap

Hecho. En modo `http` el login ya no muestra credenciales demo ni «Reset demo data».

## Estado del swap

Hecho (2026-11-04): todos los métodos implementados, proxy `/api` en Vite, Entregas recarga tras cada cambio, pagos por estado. El mock queda para demos (`VITE_DATA_SOURCE=mock`).


## Task 11 staff contract additions (2026-11-05)

- `orders.search(q)` → `GET /api/orders/search?q=…`; `orders.attention()` → `GET /api/orders/attention`. Both return `OrderSummary[]`: id, code, customerName, phone, createdAt, paymentState, checkoutStatus (lowercase/null), total, items (count), nextHandoffDate and handedOver.
- `ShopConfig.finishedPrice` joins customPrice/nameExtra. Staff must have all three finite server prices before creating a sale; there is no client price fallback. The shop still sells custom ornaments only.
- Order/bundle responses add lowercase `checkoutStatus` and `source` (`web`/`stall`). PENDING disables manual collection; PENDING/REVIEW disable painting actions.
- `AgendaSlot` adds `held` and nullable `holdUntil` (ISO instant). A held slot has `order/item/customer = null`; REVIEW holds have no expiry promise. Keep held blocks in overlap/capacity geometry.
- `AgendaDelivery` adds `remaining` and `paymentState`. The balance uses amountPaid, including deposits that differ from 50%. UI confirms before handing over a balance-due order and re-reads the bundle before handover.
- Staff HTTP mutations dispatch a data-change event after a successful response; readers also refetch on focus/visibility and every minute. HTTP 401 emits a session event; the router keeps `next` and the draft, without a full reload. Offline bootstrap retains the token.
- New stall dates with Vienna deliveries retain 400 `DAY_HAS_DELIVERIES`, field `days`; the mock follows the same rejection. Painted custom bases are not returned to stock on cancellation.

These Task 11 DTO changes were additive. Deploy the matching backend before the staff frontend; the old config does not contain finishedPrice. The handover/payment pair consists of two absolute server operations; if collection succeeds and handover fails, the balance is already paid and retry completes handover. The v1.1 item handover/cancellation contract below supersedes the earlier pending decisions.

## Staff sales list (2026-11-06)

- `orders.listSales(filters)` → staff-authenticated `GET /api/orders` without the `code` parameter. Optional filters: `state=unpaid|deposit|paid|pending|review`, `source=stall|web`, `from`/`to` calendar dates, `query` (code, customer name or at least three phone digits), zero-based `page` and `size` (default 20, maximum 50).
- The response is `{ orders: OrderSummary[], page, size, totalElements, totalPages }`, ordered by creation time and id descending. `from` and `to` include the whole selected calendar days in Europe/Vienna. Filters apply before pagination. A pending/review checkout has that displayed state and is excluded from `state=unpaid`.
- Summaries also include `source` (`stall` for legacy null sources) and `status` (`ACTIVE`/`CANCELLED`). Cancelled sales remain visible; erased orders are omitted, as in staff search. Form/track tokens, addresses and photos are excluded from the summary.
- `/staff/sales` provides quick periods Today / 7 days / All, payment/source filters, the existing code/name/phone search semantics, and a link to each order. Filter and page parameters survive the return from the order detail. No database migration is needed for this endpoint.


### Per-day painting hours (v1.1)

`GET /api/painting-days?from=&to=` returns effective numeric `openHour` / `closeHour` with the existing date/open/maxPaintings/booked fields. Staff PATCH accepts both optional hour values together, in quarter-hour steps from 00:00 through 23:45, end after start. Omitting both preserves any override. V11 stores nullable overrides; unset dates inherit the preferred market/home painting window. These values never modify market pickup times. Existing bookings remain when the owner narrows a window or capacity. Automatic suggestions, manual sales and moves use the painting hours; manual bookings retain the existing ability to exceed the daily count/closed suggestion limit. Agenda derives its board extent from the effective window plus all existing slots.

### Item handover, cancellation and QR receipt (v1.1)

- `PATCH /api/orders/{id}/handed-over` accepts `{ handedOver, itemIds? }`; omitted IDs retain the whole-order operation. V8 adds per-item handover; the order completes when the last item is handed over. Deliveries keeps one complete cart across dates, destinations and partial handovers. Date, destination and production filters select matching items for enabled controls and default batch selection; other cart items stay visible. Balance collection remains order-wide.
- `POST /api/orders/{id}/cancel` retains the order and optional reason (V9), returns eligible stock and excludes its reservations. V10 adds a maximum of two pending checkouts per client-IP hash (`request.getRemoteAddr()`), with 15-minute application reservations; exceeding the cap returns `PENDING_CHECKOUT_LIMIT`. V8–V11 are already applied in production and are preserved byte-for-byte from `release/v1.1`; invoice schema changes now use V12. The merged deployment and V12 still need PostgreSQL validation.
- The waiting QR sale reads the existing `GET /api/orders/{id}/bundle` serially, at 5-second intervals; failures back off to 10/20/30 seconds. It stops once all custom items have `formComplete`, shows **Form received**, and provides order details. Focus/visibility can refresh. No new receipt endpoint or sent-notification claim is involved.
- A successful public form submit goes directly to Track with a focused saved notice and bypasses the decorative wipe. The Track reading card stays opaque throughout its entrance.

Historical verification (2026-11-06): HTTP build, lint and 50 Node tests passed; Java was not changed in that E2E repair pass. Claude's then 681-case baseline had 40 failures, later superseded by the owner-reported 681 passes. These results do not certify this merge. Re-run and snapshot work: [E2E repair report](../tasks/audit-results/e2e-repair-2026-11-06.md).


## Task A — fixed delivery window (2026-11-08)

`GET /api/shop/config` adds `deliveryWindowStart: "18:00"` and `deliveryWindowEnd: "20:00"` (configurable `HH:mm`, Europe/Vienna). `GET /api/track/{code}` → `when`, and `GET /api/forms/{token}` → each `handoffs` entry, expose Vienna delivery as `{ kind: "vienna", date, fromHour: 18, toHour: 20, marketName: null, untilHour: null }`. Existing fields and the `vienna` discriminator stay compatible; market pickup `fromHour`/`untilHour` retain their meaning, and `toHour` is null/absent there. TypeScript fields added for older-server compatibility are optional. HTTP methods pass JSON through with no adapter changes; mock config/Track/form return the same new fields. UI consumption belongs to the separate public-UI task.

`GET /api/shop/config` also returns `confirmationEmail` (boolean): true only when SMTP (`MAIL_HOST` + `awg.mail.from`) is configured. The thanks page shows "Ich habe dir eine E-Mail mit deinem Bestellcode geschickt…" only then. Without seller data the e-mail is a payment confirmation (subject "Danke für deine Bestellung · Code …"), never an invoice.

Invoices use `V12__invoices.sql` (renamed from this branch's former V8, after production V8–V11). They run entirely behind existing payment/handover endpoints; no new public endpoint or sensitive invoice data appears in Track. See `contracts-and-dtos.md` and `deploy.md` for numbering, mail retries and seller configuration.


## Public compatibility after v1.1 integration (2026-11-12)

The current public UI remains the three-screen flow (Design → Delivery/contact → Review), with one page per ornament, tile picker, optional paid back name and no separate pet-name field or mobile design substeps. `petName` is optional; a paid back name also supplies it. The API retains existing legacy fields. Track consumes cancellation and per-item handover data while retaining the newer public layout. Staff contracts and the fixed delivery window/confirmation e-mail fields above coexist.
