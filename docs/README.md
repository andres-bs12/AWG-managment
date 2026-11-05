# ArtWithGab (AWG)

Ventas de ornamentos de Navidad personalizados (mercados Viena 2026): pedidos, agenda de pintura, pagos. App en `frontend/` (Vite + React + TS). Backend Spring en `awg-tracking/`.

## Fase actual — integración completa (desde 2026-11-04)

- **Frontend v1:** cerrado en reglas y flujos staff. Ya funciona contra el backend real (`VITE_DATA_SOURCE=http`); el mock sigue disponible para demos.
- **Backend:** API REST completa en Spring (`awg-tracking/`). Desde 2026-11-04 el dueño delegó su implementación a los agentes, respetando estas reglas.
- **Tienda web (`/buy`):** compra online solo con entrega a domicilio en Viena (mié/vie), pago con Stripe Checkout. Desactivada hasta configurar las claves (`SHOP_ENABLED`, `STRIPE_*`). Ver «Tienda web».
- **No ahora:** emails/notificaciones, dashboard, gestión de inventario en la UI, devoluciones.

Arranque front: `frontend/README.md`. Canon visual staff: FigJam Buy custom [`19:453`](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-453). NodeIds mid-fi: `docs/figma.md`. Swap mocks→HTTP: `docs/frontend-api-swap.md`. DTOs y contratos: `docs/contracts-and-dtos.md`.

## Stack y límites

Java + Spring Boot · React + TypeScript · PostgreSQL. **En el puesto** el dueño confirma manualmente los pagos recibidos; la app no cobra. Form del cliente ≠ caja. **Solo la tienda web** cobra, con Stripe Checkout alojado (el servidor crea la sesión y confirma por webhook firmado). Staff copy **EN**; público DE/EN. UI solo habla con `frontend/src/api/`. No inventes `fileKey` / `nodeId` de Figma. No commits con secretos.

## Decisiones de producto (cerradas)

- Form = datos; el staff confirma el pago después de verificar su recepción; estados: unpaid / deposit (50% del total) / paid. Con el flujo actual, `deposit` representa exactamente la mitad porque el estado por sí solo no guarda otro importe.
- Name en puesto (+12,99 €); sin refund al quitarlo. Track público en v1 (código/enlace).
- Tienda web: solo Viena (CP 1010–1230), entrega mié/vie. El cliente solo ve días en los que todos sus adornos custom caben en la agenda de pintura antes de ese día; al pagar, los bloques se reservan solos y el pedido aparece en Agenda y Entregas como uno más (pagado, tarjeta).
- Pintura ≠ pickup. Capacidad **antes** de comprometer. Pedido puede mezclar custom + finished.
- Mercado (recogida): vie/sáb/dom. Vienna domicilio: mié/vie. Bloques pintura ~60 min (~75 con nombre).
- Capacidad casa: lun/mar/jue 3 huecos (10–13); mié/vie 2 (10–12). Si viernes hay mercado, gana el puesto.

## Entidades

```
customer 1──N order 1──N order_item
market 1──N market_day
```

| Tabla | Rol |
|--------|-----|
| `customer` | `name`, `email`, `phone`. Sin dirección. |
| `order` | `code`, `payment_state`, `total`, `handed_over`, tokens form/track. Si algún ítem es Vienna → `delivery_address?` en el pedido. |
| `order_item` | custom/finished; producción; `sold_on_day_id` (venta); `paint_start`/`paint_end` (pintura); `delivery_kind` + `handoff_date` + `pick_up_time` (entrega); datos del form. Ver reglas abajo. |
| `market` | `kind` market \| home; temporada; `stall`; coste. Sin open/close. |
| `market_day` | `date`, `open_time`, `close_time` por jornada. |

### `order_item`: venta, pintura y entrega

Cada adorno tiene hasta tres momentos, y cada uno se guarda en campos separados. Ejemplo: se vende el sáb 22/11 en el puesto, Gaby lo pinta el mar 25/11 de 10:00 a 11:15 y el cliente lo recoge el vie 28/11 a las 14:00.

| Momento | Campos | Tipo | Regla |
|---------|--------|------|-------|
| Venta | `soldOnDay` | `MarketDay` | Jornada del puesto donde se vendió (estadísticas). No es la recogida. |
| Pintura | `paintStart`, `paintEnd` | `LocalDateTime` | **CUSTOM:** obligatorios, se asignan en la venta para que ningún encargo quede sin horario; `paintEnd > paintStart`. **GENERIC:** `null`. Cualquier día (casa o puesto), lo elige Gaby. |
| Entrega | `deliveryKind`, `handoffDate`, `pickUpTime` | enum, `LocalDate`, `LocalTime` | **MARKET:** fecha y hora obligatorias; la hora es el límite para tener el adorno listo. **DELIVERY (Viena):** fecha obligatoria, hora `null` (la decide quien transporta). |

- Si es CUSTOM y MARKET, la pintura debe terminar antes de `handoffDate + pickUpTime`.
- Las fechas y horas son de reloj en Viena (`LocalDateTime`/`LocalDate`/`LocalTime`, no `Instant`).
- Estas reglas son condicionales, así que se validan en `OrderService.createOrder` (400 si fallan) y no con anotaciones en el DTO.
- No hay entidad `TimeBlock`: el bloque de pintura que pide el front se arma desde `paintStart`/`paintEnd` del ítem.

Tipos UI de referencia: `frontend/src/domain/types.ts` (la UI mock aún guarda address por ítem; el esquema canónico es address en Order).

## Tienda web

Días de entrega: miércoles o viernes que no sean día de puesto (en viernes de mercado manda el puesto). La pintura se busca en la semana previa, empezando por el día más cercano a la entrega. Stripe solo acepta tarjeta, así que una sesión completada siempre está pagada; `async_payment_failed` y `expired` liberan el pedido. Mientras el pago web está pendiente, el staff no puede cambiar su estado de pago.

Online **solo se venden adornos personalizados** (decisión del dueño, 2026-11-04); el servidor rechaza `finished`. `GET /api/shop/config` devuelve precios y `colors` (`{color, inStock}` según el inventario).

1. `/buy` es una tienda por pasos: 1 adorno(s) (color disponible + nombre opcional detrás) → 2 tu mascota (nombre y fotos) → 3 día de entrega (`POST /api/shop/delivery-dates`) → 4 dirección y contacto → 5 resumen y pago.
2. `POST /api/shop/checkout` (multipart) bajo el lock de agenda: re-planifica, reserva bloques y stock, crea el pedido `WEB` + `PENDING` (oculto en Agenda/Entregas, pero ocupa sus horas) y devuelve la URL de Stripe.
3. Webhook `POST /api/shop/stripe/webhook` (firma HMAC verificada): `checkout.session.completed` con importe y moneda correctos → `PAID`/`card`/`CONFIRMED`. `checkout.session.expired` → borra el pedido y devuelve stock, horas y fotos. El job cada 5 min consulta a Stripe antes de borrar: si la sesión está `complete` y pagada (webhook tardío) confirma el pedido; si sigue `open`, espera. Webhook, checkout y job comparten el lock de agenda. Si Stripe falla en el checkout se borran las fotos ya escritas. Timeouts de Stripe: 5 s conexión / 15 s lectura.
4. `/buy/thanks?code=…` → enlace a Track.

Configuración (variables de entorno): `SHOP_ENABLED=true`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` (origen del front para volver de Stripe), `SHOP_DELIVERY_FEE` (0 por defecto). En Stripe: endpoint del webhook con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`.

## Arranque local

```bash
createdb awg_tracking
cd awg-tracking && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
cd frontend && VITE_DATA_SOURCE=http npm run dev
```

El perfil `dev` crea el mercado demo Rathausplatz, los días de pintura en casa, stock inicial y los usuarios `gaby@…`/`andres@…` con las mismas contraseñas demo del mock. Sin `dev`, los usuarios solo se crean si se pasan `STAFF_GABY_PASSWORD`/`STAFF_ANDRES_PASSWORD`. Tests: `./mvnw test` (H2, reloj fijo).

## Frontend staff (cerrado)

Rutas: `/staff/agenda`, `/deliveries`, `/markets`, `/sales/new`, `/orders/:id`, paint. Wizard: items → delivery → qr → payment → done (`saleDraft.ts`). Tokens `--staff-*`. Primitivas en `components/ui` con `tone="staff"`. No tocar el orden del wizard ni el contrato `api` salvo petición.

## Qué no cargar

`references/html-mocks/`, `mocks/`, diagramas `docs/flujo-venta.*` — no son canon.
