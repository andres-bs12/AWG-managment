# Sustituir mocks por Spring

La UI llama solo a `api` (`frontend/src/api/client.ts`). Hoy `VITE_DATA_SOURCE=mock`. El cliente HTTP vive en `frontend/src/api/http/services.ts` y lanza un error claro hasta que implementes `fetch`.

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

## 3. Mapa sugerido (cuando existan los controllers)

| Servicio UI | Método | Endpoint Spring sugerido |
|-------------|--------|--------------------------|
| `auth.login` | POST | `/api/staff/login` → `{ token, user }` |
| `auth.me` | GET | `/api/staff/me` |
| `auth.logout` | POST | `/api/staff/logout` (o no-op si JWT stateless) |
| `markets.listMarkets` | GET | `/api/markets` |
| `markets.listMarketDays` | GET | `/api/markets/{id}/days` o `/api/market-days` |
| `agenda.listDays` / `getDay` | GET | `/api/agenda?date=` |
| `agenda.checkCapacity` | POST | `/api/agenda/capacity` |
| `agenda.moveBlock` | PATCH | `/api/time-blocks/{id}` |
| `orders.createSale` | POST | `/api/orders` |
| `orders.getOrder` / `getOrderBundle` | GET | `/api/orders/{id}` |
| `orders.getOrderByCode` | GET | `/api/orders?code=` |
| `orders.setItemStatus` | PATCH | `/api/order-items/{id}/status` |
| `payments.setPaymentState` | POST | `/api/orders/{id}/payments` |
| `forms.getForm` | GET | `/api/forms/{token}` |
| `forms.submitForm` | POST | `/api/forms/{token}` |
| `uploads.toPhoto` | POST | `/api/uploads` (multipart) → URL, no data URL |
| `tracking.getByCode` | GET | `/api/track/{code}` |
| `tracking.updateViennaAddress` | PATCH | `/api/track/{code}/address` |

Ajusta paths al estilo del backend; el punto es **un método UI = un fetch**, no lógica de negocio en React.

## 4. Fotos y Stripe

- Mock: `FileReader` → `dataUrl` en memoria.
- Real: `FormData` al storage que elijas; guarda URL en `OrderItem.photos`.
- Pago card: hoy `setPaymentState(..., 'card')`. Sustituye por Checkout/PaymentIntent y, al webhook, el mismo `paymentState`.

## 5. Checklist de swap

1. Implementar helper `request(path, init)` con JSON + Bearer.
2. Rellenar `http/services.ts` método a método (empieza por `auth` + `tracking.getByCode`).
3. Poner `VITE_DATA_SOURCE=http`.
4. Borrar `localStorage` key `awg-mock-store-v3` (solo mock).
5. Quitar el botón “Reset demo data” del login cuando ya no haga falta.

Los HTML antiguos están en `references/html-mocks/` — no son la app.
