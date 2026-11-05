# Sustituir mocks por Spring

On-demand: no forma parte de la fase UX staff. La UI llama solo a `api` (`frontend/src/api/client.ts`). Hoy `VITE_DATA_SOURCE=mock`. El cliente HTTP vive en `frontend/src/api/http/services.ts` y lanza un error claro hasta que implementes `fetch`.

## 1. Encender HTTP

En `frontend/.env`:

```
VITE_DATA_SOURCE=http
VITE_API_BASE_URL=http://localhost:8080
```

No hace falta tocar páginas. Si un método sigue en stub, fallará con el mensaje de `http/services.ts`.

## 2. Contrato

Tipos en `frontend/src/domain/types.ts` (nombres alineados a FigJam Entities: `Customer`, `Order`, `OrderItem`, `Market`, `MarketDay`, `TimeBlock`, `StaffUser`).

Interfaces en `frontend/src/api/contracts.ts`. Implementa cada método en `http/services.ts` con `fetch(`${import.meta.env.VITE_API_BASE_URL}/...`)`.

Auth: el staff ya guarda un token en `localStorage` (`awg-staff-token`) y `AuthContext` lo revalida con `api.auth.me`. En HTTP, manda `Authorization: Bearer <token>` en el helper de `fetch`.

## 3. Mapa implementado

Todos los cuerpos y respuestas tienen la forma exacta de `frontend/src/domain/types.ts`. Errores: `{ status, message }`.

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

These are additive DTO changes with no entity/schema change. Deploy the matching backend before the staff frontend; the old config does not contain finishedPrice. The handover/payment pair consists of two absolute server operations; if collection succeeds and handover fails, the balance is already paid and retry completes handover. Order-level handover and hard cancellation remain pending owner decisions.
