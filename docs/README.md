# ArtWithGab (AWG)

Ventas de ornamentos de Navidad personalizados (mercados Viena 2026): pedidos, agenda de pintura, pagos. App en `frontend/` (Vite + React + TS). Backend Spring en `awg-tracking/`.

## Producción · v3.1.0 (2026-11-20)

Frontend HTTP y API REST Spring en producción. El mock queda para desarrollo y demos. El staff gestiona ventas, agenda, inventario, entregas y estadísticas. La tienda cobra con Stripe Checkout y ofrece recogida en el mercado o envío por Österreichische Post.

[Arranque del frontend](../frontend/README.md) · [Contrato HTTP](frontend-api-swap.md) · [DTOs](contracts-and-dtos.md) · [Figma](figma.md).

## Stack y límites

Java + Spring Boot · React + TypeScript · PostgreSQL. **En el puesto** el dueño confirma manualmente los pagos recibidos; la app no cobra. Form del cliente ≠ caja. **Solo la tienda web** cobra, con Stripe Checkout alojado (el servidor crea la sesión y confirma por webhook firmado). Staff copy **EN**; público DE/EN. UI solo habla con `frontend/src/api/`. No inventes `fileKey` / `nodeId` de Figma. No commits con secretos.

## Decisiones de producto (cerradas)

- Form = datos; el staff confirma el pago después de verificar su recepción; estados: unpaid / deposit / paid. El depósito tiene un importe real (`amountPaid`), 50 % por defecto, editable a un valor mayor que cero y menor que el total. El saldo usa ese importe.
- Nombre personalizado por 12,99 € por defecto, editable como precio en Stock. Track público por código/enlace.
- La tienda solo ofrece opciones para las que cabe toda la pintura antes de la recogida en mercado o de la recogida de Correos. El checkout reserva pintura y stock mientras Stripe confirma el pago.
- Pintura ≠ pickup. Capacidad **antes** de comprometer. Pedido puede mezclar custom + finished.
- Recogida en mercado según las jornadas publicadas. Los bloques de pintura suelen durar 60 min (75 con nombre).
- Capacidad casa: lun/mar/jue 3 huecos (10–13); mié/vie 2 (10–12). Si hay puesto efectivo de pintura, se usa su ventana salvo una configuración del día.

## Entidades

```
customer 1──N order 1──N order_item
market 1──N market_day
```

| Tabla | Rol |
|--------|-----|
| `customer` | `name`, `email`, `phone`. Sin dirección. |
| `order` | `code`, `payment_state`, `total`, `handed_over`, tokens form/track. Dirección opcional en el pedido y `tracking_number` para Post. |
| `order_item` | custom/finished; producción; `sold_on_day_id` (venta), `market_ornament_id` (stock numerado); `paint_start`/`paint_end` (pintura); `delivery_kind` + `handoff_date` + `handoff_day_id` + `pick_up_time` (entrega) y rango `arrival_from`/`arrival_to` para Post; datos del form. Ver reglas abajo. |
| `market` | `kind` market \| home; temporada; `stall`; coste. Sin open/close. |
| `market_day` | `date`, `open_time`, `close_time` por jornada. |
| `painting_day` | Horario y puesto de pintura configurable por fecha (`painting_market_id`). |
| `market_ornament` | Estado, revisión y foto del adorno numerado. |

### `order_item`: venta, pintura y entrega

Cada adorno tiene hasta tres momentos, y cada uno se guarda en campos separados. Ejemplo: se vende el vie 27/11 en un puesto, Gaby lo pinta el sáb 28/11 de 10:00 a 11:15 y el cliente lo recoge el dom 29/11 a las 14:00.

| Momento | Campos | Tipo | Regla |
|---------|--------|------|-------|
| Venta | `soldOnDay` | `MarketDay` | Jornada del puesto donde se vendió (estadísticas). No es la recogida. |
| Pintura | `paintStart`, `paintEnd` | `LocalDateTime` | **CUSTOM:** obligatorios, se asignan en la venta para que ningún encargo quede sin horario; `paintEnd > paintStart`. **FINISHED:** `null`. Cualquier día (casa o puesto), lo elige Gaby. |
| Entrega | `deliveryKind`, `handoffDate`, `pickUpTime` | enum, `LocalDate`, `LocalTime` | **MARKET:** fecha y hora obligatorias; la hora es el límite para tener el adorno listo. **POST:** fecha de recogida por Correos y rango de llegada, sin hora. **VIENNA:** entrega a domicilio histórica. |

- Para CUSTOM y MARKET, la pintura acaba antes de la hora de recogida. Si ambos ocurren el mismo día, la recogida debe ser en el puesto donde pinta Gaby.
- Las fechas y horas son de reloj en Viena (`LocalDateTime`/`LocalDate`/`LocalTime`, no `Instant`).
- El servidor valida estas reglas al vender y al cambiar la agenda. Una incompatibilidad de puesto devuelve 409 `PAINT_NOT_AT_THIS_MARKET`.
- No hay entidad `TimeBlock`: el bloque de pintura que pide el front se arma desde `paintStart`/`paintEnd` del ítem.

Tipos UI de referencia: `frontend/src/domain/types.ts` (la UI mock aún guarda address por ítem; el esquema canónico es address en Order).

## Tienda web

`/buy` vende adornos personalizados en tres pantallas (diseño, entrega/contacto y revisión). El nombre del reverso es opcional. Se entra a Stripe Checkout desde la revisión y a Track desde `/buy/thanks?code=…`.

- **Recogida en mercado.** `POST /api/shop/pickup-days` devuelve fechas con capacidad y su `marketDayId`. Las recogidas web empiezan por defecto el 30 de noviembre. El cliente elige hora y tiene un enlace de Google Maps. Cuando coinciden dos mercados, la tienda solo ofrece el puesto primario abierto configurado en `SHOP_PRIMARY_PICKUP_MARKET_ID`.
- **Envío por Österreichische Post a toda Austria.** `POST /api/shop/shipping-quote` calcula recogida y rango estimado. Por defecto son 5 € por pedido, recogida mar/vie (festivo pasa al siguiente día laborable) y llegada 2–3 días laborables después, como máximo el 23 de diciembre. La recogida es posterior a la pintura. Para pedidos web por Post, la pintura empieza el 25 de noviembre y el mínimo de recogida queda sin configurar por defecto. La tarifa y los días semanales se editan en Stock. Se pueden enviar piezas terminadas del puesto si el mismo pedido lleva una pieza personalizada también por Post. Los pedidos antiguos `vienna` siguen legibles.
- **Pago.** El checkout multipart vuelve a comprobar el plan bajo `ScheduleLock`. Un pedido web pendiente reserva tiempo y stock durante 15 minutos y se muestra en Agenda como reserva sin datos del cliente. El webhook firmado o la reconciliación con Stripe confirma el pago. Un importe inesperado deja el pedido en revisión. Una sesión expirada sin pago libera sus reservas.
- **Textos legales.** Impressum de vendedora privada, AGB y Datenschutz publicados. La política identifica AWS, Cloudflare y Brevo. Las revisiones del asesor están en [el backlog](../tasks/todo.md).

[Contrato HTTP](frontend-api-swap.md) · [Configuración y Stripe](deploy.md) · [Contrato de implementación de Post](../tasks/post-shipping-contract-2026-11-20.md).

## Arranque local

```bash
createdb awg_tracking
(cd awg-tracking && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev)

# En otra terminal, desde la raíz del repositorio
(cd frontend && npm install && VITE_DATA_SOURCE=http npm run dev)
```

El perfil `dev` crea el mercado demo Rathausplatz, los días de pintura en casa, stock inicial y los usuarios `gaby@…`/`andres@…` con las mismas contraseñas demo del mock. Sin `dev`, los usuarios solo se crean si se pasan `STAFF_GABY_PASSWORD`/`STAFF_ANDRES_PASSWORD`. Tests: `./mvnw test` (H2, reloj fijo).

## Frontend staff

- `/staff/sales/new`: venta con dos opciones iniciales (Custom y Finished), pasos 1–2–3 y confirmación al descartar. Las piezas numeradas se venden aquí con un selector en línea por foto. Cancelar una venta devuelve el adorno numerado a `painted`. Stock permite editar disponibilidad y fotos. Statistics incluye «Non-personalised sold».
- `/staff/agenda`: calendario con edición de horas, capacidad y puesto de pintura, movimiento por pulsación larga y Make room. Ready libera el tiempo futuro y, si se termina antes el día de pintura, acorta la sesión. «I'm at» es por dispositivo en los dos puestos del 25 al 29 de noviembre. El puesto de venta y el de recogida se registran por separado.
- `/staff/deliveries`: entregas del mercado y lista Ship por fecha de recogida de Correos. «Handed to Post» admite un número opcional que enlaza al seguimiento de post.at. `/staff/sales` muestra el puesto de venta. En iPad, New sale y More son las entradas de navegación y la búsqueda está en la cabecera.

Reglas vigentes en [AGENTS.md](../AGENTS.md) y [el sistema de diseño staff](design-system.md#staff). Los mocks de referencia y los diagramas `flujo-venta.*` son históricos.
