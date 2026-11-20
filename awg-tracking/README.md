# awg-tracking (backend)

Spring Boot / Java. Esqueleto + modelos de dominio en curso.

**Quién escribe aquí:** el dueño del repo. Los agentes no modifican este módulo (modelos, enums, API, POM, …) salvo petición explícita.

Contrato que consume la UI: `frontend/src/api/contracts.ts` + `frontend/src/domain/types.ts`. Swap HTTP: [docs/frontend-api-swap.md](../docs/frontend-api-swap.md). Contexto: [docs/README.md](../docs/README.md).

## Dos mercados simultáneos · 25–29 de noviembre de 2026

- `POST /api/orders` acepta `soldOnMarketDayId` en la raíz. En un día con dos puestos abiertos se exige el ID del puesto de venta de hoy. Si el ID falta o no corresponde, responde 400 `VALIDATION` con `field: "soldOnMarketDayId"`. Cada ítem lleva su propio `marketDayId` para recogida, que puede pertenecer al otro puesto. El ID de venta se usa para la entrega inmediata de un adorno acabado cuando falta el ID de recogida.
- `GET /api/market-days` devuelve un ID por puesto y fecha. New sale puede usar `useStaffMarket().activeMarketDay` desde `frontend/src/lib/staffMarket.ts` para el ID de venta y sugerir el puesto activo por defecto. Las opciones de recogida se identifican por `marketDayId`; la etiqueta combina el nombre y la fecha. El stock numerado sigue siendo compartido.
- `GET /api/agenda/days` devuelve `markets` y `marketDays` con todos los puestos abiertos por fecha, además del día de referencia usado por el calendario. Las recogidas tienen `marketId`, `marketName` y `marketDayId`. V16 conserva el puesto de recogida en `handoff_day_id` y completa los pedidos anteriores con el mismo criterio estable del calendario (menor UUID del día de mercado).
- `PATCH /api/painting-days/{date}` acepta `paintingMarketId`: ID de un mercado abierto ese día, `null` para quitar la selección u omisión para conservarla. Una actualización que envía solo este campo conserva horarios y disponibilidad. Agenda y Painting days devuelven la selección en `paintingMarketId` y `paintingMarketName`. El `market` del día de Agenda indica el puesto efectivo (selección, puesto primario abierto o puesto que abre primero).
- Un adorno personalizado solo se pinta y se recoge el mismo día cuando ambos ocurren en el puesto efectivo de pintura. New sale, las sugerencias y los movimientos usan esta regla. Una reserva incompatible devuelve 409 `PAINT_NOT_AT_THIS_MARKET` con el nombre del puesto. Si un cambio de puesto de pintura dejaría recogidas del mismo día en otro mercado, devuelve el mismo código e indica cuántas quedarán afectadas.
- New sale envía el `handoffMarketDayId` a `POST /api/agenda/capacity` y `POST /api/agenda/move-suggestion` para excluir sesiones incompatibles. Desde el otro puesto, el plan empieza al día siguiente y el selector propone la próxima recogida compatible.
- La tienda aplica `awg.shop.deliveries-from` (30 de noviembre de 2026 por defecto) y el plazo mínimo tanto a recogidas como a entregas en Viena. Las opciones y el checkout requieren que la pintura termine antes del día de entrega o recogida.
- `POST /api/shop/pickup-days` devuelve `marketDayId`. El checkout lo envía junto a `deliveryDate` y `pickupTime`. Si el puesto ha cambiado o no se ha elegido en una fecha con solapamiento, responde 400 `PICKUP_DAY_INVALID` en `deliveryDate`. Se acepta la fecha sin ID cuando solo abre un puesto.
- Para designar el puesto web en fechas con solapamiento, configura su UUID en `SHOP_PRIMARY_PICKUP_MARKET_ID` (`awg.shop.primary-pickup-market-id`). Si el puesto primario está sin configurar o está cerrado ese día, la tienda omite la fecha solapada y rechaza el checkout. Con Compose, pasa la variable al contenedor.
