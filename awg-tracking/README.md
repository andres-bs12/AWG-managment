# awg-tracking (backend)

API REST de ArtWithGab en Java 21 y Spring Boot, con PostgreSQL en producción y H2 en tests. v3.1.0 se desplegó el 20 de noviembre de 2026 (`389a1b3`).

El contrato de la UI vive en `frontend/src/api/contracts.ts` y `frontend/src/domain/types.ts`. Ver [mapa HTTP](../docs/frontend-api-swap.md) y [despliegue](../docs/deploy.md).

## Arranque local

Desde `awg-tracking/`, con PostgreSQL y la base `awg_tracking` disponibles:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
./mvnw test
```

El perfil `dev` carga datos y cuentas demo. La suite de la versión registró 270 pruebas de backend.

## Migraciones

Flyway **V1–V17**, con `ddl-auto=validate`. En v3.1.0 se aplicaron:

| Versión | Cambio |
| --- | --- |
| V14 | `price_setting` y recargo por nombre persistido por ítem. |
| V15 | Stock numerado (`market_ornament`, `order_item.market_ornament_id`). |
| V16 | Puesto de recogida (`order_item.handoff_day_id`) y puesto de pintura (`painting_day.painting_market_id`). |
| V17 | Österreichische Post, excepciones de recogida, rango de llegada, seguimiento y replays de Make room (V18 quedó integrada en V17). |

V16 rellena recogidas antiguas con el día de venta si coincide; después elige el puesto que abre antes, con desempate por nombre e ID. Las migraciones aplicadas son inmutables.

## Dos mercados simultáneos · 25–29 de noviembre de 2026

- `POST /api/orders` acepta `soldOnMarketDayId` en la raíz. En un día con dos puestos abiertos se exige el ID del puesto de venta de hoy. Si el ID falta o no corresponde, responde 400 `VALIDATION` con `field: "soldOnMarketDayId"`. Cada ítem lleva su propio `marketDayId` para recogida, que puede pertenecer al otro puesto. El ID de venta se usa para la entrega inmediata de un adorno acabado cuando falta el ID de recogida.
- `GET /api/market-days` devuelve un ID por puesto y fecha. New sale puede usar `useStaffMarket().activeMarketDay` desde `frontend/src/lib/staffMarket.ts` para el ID de venta y sugerir el puesto activo por defecto. Las opciones de recogida se identifican por `marketDayId`; la etiqueta combina el nombre y la fecha. El stock numerado sigue siendo compartido.
- `GET /api/agenda/days` devuelve `markets` y `marketDays` con todos los puestos abiertos por fecha, además del día de referencia usado por el calendario. Las recogidas tienen `marketId`, `marketName` y `marketDayId`. V16 conserva el puesto de recogida en `handoff_day_id`. El dispositivo guarda «I'm at» como `awg-active-market-id`.
- `PATCH /api/painting-days/{date}` acepta `paintingMarketId`: ID de un mercado abierto ese día, `null` para quitar la selección u omisión para conservarla. Una actualización que envía solo este campo conserva horarios y disponibilidad. Agenda y Painting days devuelven la selección en `paintingMarketId` y `paintingMarketName`. El `market` del día de Agenda indica el puesto efectivo (selección, puesto primario abierto o puesto que abre primero).
- Un adorno personalizado solo se pinta y se recoge el mismo día cuando ambos ocurren en el puesto efectivo de pintura. New sale, las sugerencias y los movimientos usan esta regla. Una reserva incompatible devuelve 409 `PAINT_NOT_AT_THIS_MARKET` con el nombre del puesto. Si un cambio de puesto de pintura dejaría recogidas del mismo día en otro mercado, devuelve el mismo código e indica cuántas quedarán afectadas.
- New sale envía el `handoffMarketDayId` a `POST /api/agenda/capacity` y `POST /api/agenda/move-suggestion` para excluir sesiones incompatibles. Desde el otro puesto, el plan empieza al día siguiente y el selector propone la próxima recogida compatible.
- La recogida web usa `awg.shop.deliveries-from` (30 de noviembre de 2026 por defecto). Post tiene parámetros de pintura y recogida propios. En ambos casos, la tienda busca huecos de pintura anteriores al día de recogida.
- `POST /api/shop/pickup-days` devuelve `marketDayId`. El checkout lo envía junto a `deliveryDate` y `pickupTime`. Si el puesto ha cambiado o no se ha elegido en una fecha con solapamiento, responde 400 `PICKUP_DAY_INVALID` en `deliveryDate`. Se acepta la fecha sin ID cuando solo abre un puesto.
- Para designar el puesto web en fechas con solapamiento, configura su UUID en `SHOP_PRIMARY_PICKUP_MARKET_ID` (`awg.shop.primary-pickup-market-id`). Si el puesto primario está sin configurar o está cerrado ese día, la tienda omite la fecha solapada y rechaza el checkout. Con Compose, pasa la variable al contenedor.


## Stock y envíos

- El stock numerado se vende mediante `POST /api/orders` desde New sale. Cancelar devuelve la pieza elegible a `painted`. `/api/market-stock` gestiona estado, revisión y fotos JPEG de hasta 5 MB.
- `POST /api/shop/shipping-quote` calcula el rango de Post. `POST /api/shipping/window` y `GET/PUT /api/shipping/collection-days` sirven al staff (el PUT usa `/{date}`). Austria, 5 € por pedido, recogida mar/vie y llegada estimada en 2–3 días laborables, con límite por defecto del 23 de diciembre. Los pedidos `vienna` antiguos siguen legibles.
- Ready libera la reserva futura. En el día de pintura, el fin registrado puede acortarse al cuarto de hora si se termina antes. Make room mueve sesiones elegibles dentro del plazo existente. Ver [contrato HTTP](../docs/frontend-api-swap.md).
