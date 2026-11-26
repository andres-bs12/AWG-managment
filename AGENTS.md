# Contexto del proyecto — ArtWithGab (AWG)

**Actualizado:** 2026-11-26 (panel «Sold at» para cambiar el mercado de una venta; tarjetas de piezas terminadas sin producción ni entrega duplicada). Antes: 2026-11-22 (v3.2.0 en `main` y en producción: correos HTML, «Mark reviewed», conector MCP y arreglos de la prueba real; Flyway V18–V19; producción sin pedidos de prueba: solo queda el mercado «Casa»; backups `~/backups/pre-cleanup-20261122T2218.sql.gz` y `pre-cleanup2-20261122T2301.sql.gz`)
**Propósito de este archivo:** memoria persistente para el dueño del proyecto y los agentes que trabajen en este repositorio.

## Instrucción de mantenimiento

Lee este archivo y **`docs/reglas-aprendidas.md`** (errores que no se repiten, reglas de copy, espaciado, color, móvil y seguridad) al comenzar una tarea; añade allí cada corrección nueva del dueño. Después de un cambio importante, actualízalo para reflejar el estado real: decisiones nuevas, trabajo terminado, pendientes, problemas conocidos y cambios locales relevantes. Mantén un resumen útil y conciso; no copies la conversación completa ni dejes como vigente información obsoleta. Antes de describir o cambiar el estado del código, revisa `git status` y los diffs actuales.

No descartes, reviertas ni sobrescribas cambios locales sin confirmar como parte de otra tarea sin una instrucción explícita.

## Proyecto y fase

ArtWithGab es una herramienta para registrar ventas y coordinar la producción y entrega de ornamentos navideños personalizados en los mercados de Viena de 2026. La aplicación tiene una interfaz pública y herramientas de staff.

- **Frontend:** React, TypeScript y Vite, en `frontend/`. Flujos staff cerrados; funciona contra el backend real (`VITE_DATA_SOURCE=http`) o el mock.
- **Backend:** Java 21, Spring Boot 4.1.1 y Maven, en `awg-tracking/`. API REST completa (ver `docs/frontend-api-swap.md`).
- **Base de datos:** PostgreSQL (`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`; local por defecto `awg_tracking`). Tests en H2, salvo `PostgresSchemaTests`, que arranca la app contra PostgreSQL 17 real (Testcontainers, necesita Docker) con todas las migraciones Flyway y `ddl-auto=validate`, igual que producción.
- **Fase:** desde 2026-11-04 el dueño delegó a los agentes la implementación del backend y la integración; se trabaja por sprints con auditoría (código, seguridad, UX/UI) al final de cada uno, y las dudas van a `tasks/preguntas-pendientes.md`.

## Reglas de producto y límites

- **UI pública:** leer y aplicar obligatoriamente `docs/design-system.md` antes de cualquier cambio; `docs/design-system-audit.md` registra la migración pendiente.

- El formulario del cliente recoge datos y fotos; no cobra. El staff confirma manualmente un pago después de verificar que se recibió.
- Estados de pago acordados en la documentación: `unpaid`, `deposit` y `paid`. `deposit` guarda el importe recibido en `amountPaid`: 50 % por defecto, editable a un importe mayor que cero y menor que el total. El saldo se calcula con ese importe real.
- En el puesto no se integra ningún procesador de pagos. **Excepción decidida por el dueño (2026-11-04):** la tienda web pública (`/buy`, envío por Correos a Austria o recogida en el puesto) cobra con Stripe Checkout.
- **Tamaños (dueño, 2026-11-26, V21):** cada adorno personalizado es Big 10 cm o Medium 8 cm y el tamaño se elige siempre (sin valor por defecto) en `/buy` y en New sale. Precios: Big 50 €, Medium 45 €, no personalizado 35 €, todos editables en Stock (`customPrice`, `customMediumPrice`, `finishedPrice`); V21 los fija en producción y marca como Big los personalizados anteriores. El stock de bases se cuenta por color, acabado y tamaño (V22): las filas Big conservan lo contado y las Medium empiezan en 0 hasta que el dueño las cuente en Stock; un tamaño sin bases sale como agotado en `/buy` y en New sale.
- **Descuentos (dueño, 2026-11-26, V24):** en New sale, «Give a discount» fija el total cobrado de todo el pedido (nunca mayor que el precio de lista). `orders.total` es lo cobrado y `orders.discount` la diferencia, así que pagos, Sales y Statistics usan el importe real. En el detalle del pedido, «Change price» (con confirmación) cambia el precio de una venta del puesto ya hecha; si estaba pagada, lo recibido sigue al nuevo total. Los pedidos web no se pueden cambiar.
- **Mercado de una venta ya hecha (dueño, 2026-11-26):** en el detalle de una venta del puesto, el panel «Sold at» muestra a qué mercado cuenta la venta y permite cambiarlo a otro mercado abierto ese mismo día (`PATCH /api/orders/{id}/market`). Por qué: las primeras ventas del 26 nov se hicieron antes de cargar el mercado real y quedaron sin mercado; antes solo se arreglaba tocando la base de datos.
- **Pedidos de piezas terminadas (dueño, 2026-11-26):** una pieza `finished` ya está pintada, así que su tarjeta no muestra «Production» (foto de referencia, «Adjust production status»). Si el pedido solo tiene piezas terminadas, la entrega se hace con el único botón del panel Pickup: las tarjetas no repiten «Hand over this one»/«Undo handover». En pedidos mixtos (personalizado + terminado) cada pieza conserva su botón, porque se entregan en días distintos.
- **Detalle de pedido entregado (dueño, 2026-11-26, encima de lo anterior):** cuando todo el pedido está entregado (`order.handedOver`), `OrderDetailPage` pasa `orderDone` a `OrderItemCard`, que oculta Production, «Adjust production status» y el bloque Handover de cada adorno (el estado dice «Handed over»; un personalizado con foto conserva «View reference»). El resumen de arriba dice «Picked up / Delivered / Handed to Post» con mercado, día y hora **reales de la entrega** (`order.handedOverAt`, hora de Viena; nunca el horario de apertura del mercado, que solo tiene sentido antes de entregar), así que el panel Pickup/Delivery no se muestra (el de Post sí, por el número de seguimiento). «Undo handover» aparece **una sola vez**, abajo del todo, discreto y en rojo, en el lugar de «Cancel order» (que no se muestra: hay que deshacer la entrega primero); abre la confirmación de siempre. En ventas del puesto, el resumen de arriba tiene una celda propia «Sold at» (separada por línea, como «Total · paid») con «Change» a la derecha del nombre, que abre un diálogo; ya no hay panel «Sold at» abajo. La celda del total tiene el mismo «Change» a la derecha y abre el diálogo «Change price?» (`ChangePriceDialog`), así que el panel Payment ya no repite «Change price». Ya no hay desplegable «Order info» ni línea «Stall order · Paid by…»: dónde se vendió lo dice la celda «Sold at» (el mercado, o «Web shop» en pedidos web), la forma de pago va en la cabecera de Payment («Paid · Cash») y solo queda una línea gris «Created…» cuando la venta y la entrega no fueron en el mismo momento. «Customer form» no se muestra en un pedido entregado. Una venta del puesto solo de piezas terminadas y ya entregada (`walkInSale`) no muestra «View customer tracking» (el cliente se la llevó, no hay nada que seguir) ni «Customer contact» si no hay teléfono ni e-mail. En Payment, «Correct payment» es un botón que abre su formulario debajo (antes desplegable). Todo por comentarios del dueño sobre la captura: quería ver lo esencial sin abrir nada. Motivo: el dueño vio el botón duplicado y textos sin sentido en un pedido terminado. Afecta también a pedidos personalizados y mixtos entregados. Con entregas parciales siguen los botones por adorno, pero un adorno ya entregado no permite cambiar su estado de producción. Pruebas: `e2e/staff-review.spec.ts` («item handover and undo…»).
- **Lista de revisión de UI (dueño, 2026-11-26; revisar cada pantalla y cada captura contra ella antes de enseñarla):**
  1. **Nada duplicado:** una acción o un dato aparece una sola vez por pantalla (ni dos «Undo handover», ni «Sold at» arriba y abajo).
  2. **Solo lo que aplica al estado:** no mostrar bloques, textos ni botones desactivados que no sirven en ese estado del pedido (Production en una pieza terminada, Customer form o Cancel en un pedido entregado).
  3. **No repetir lo que ya está a la vista** ni esconder en un desplegable lo que cabe en una línea («Order info»).
  4. **Separadores coherentes:** datos hermanos van en celdas iguales, divididas por la misma línea (resumen: Pickup | Sold at | Total). No apilar un dato nuevo dentro de la celda de otro.
  5. **Sin huecos vacíos:** un bloque sin contenido no se renderiza, y el último bloque de una tarjeta no deja margen extra bajo él.
  6. **Acciones destructivas o de corrección:** abajo del todo, discretas y en rojo, una sola vez, con confirmación.
  7. **Mismo patrón en celdas hermanas:** valor a la izquierda y su «Change» a la derecha en la misma línea, en todas las celdas y también en teléfono (allí una celda por fila).
  8. **Dato real, no el planificado:** en algo ya hecho se muestra cuándo ocurrió (día y hora), no el rango u horario previsto.
  9. **Acciones como botones** cuando son pocas y claras (p. ej. «Correct payment»), no desplegables.
- El nombre personalizado en el adorno cuesta 12,99 € como respaldo de configuración, editable en Stock (en producción está en 5 €, guardado el 21 nov). No se puede quitar después del pedido, así que la UI pública ya no muestra un aviso de «sin reembolso» (dueño, 2026-11-12).
- Un pedido puede mezclar adornos `custom` y `finished`. Pintura y recogida/entrega son eventos distintos; comprobar capacidad antes de comprometer un bloque.
- Recogida en mercado: viernes, sábado o domingo. **Desde v3.1.0 se envía por Österreichische Post a toda Austria (+5 €, editable en Stock)**. Los pedidos antiguos `vienna` siguen legibles.
- Capacidad de pintura en casa: lunes, martes y jueves, 3 huecos entre 10:00–13:00; miércoles y viernes, 2 huecos entre 10:00–12:00. Un bloque suele durar 60 minutos, unos 75 si incluye nombre.
- El idioma del staff es inglés; la experiencia pública es alemán/inglés.
- La UI accede a datos solo mediante `frontend/src/api/`. El mock es la fuente predeterminada (`VITE_DATA_SOURCE=mock`); también existe implementación HTTP.
- Dashboard no forma parte de la fase actual. Los e-mails existen pero dependen de SMTP; el stock se edita en `/staff/inventory`. No inventes IDs (`fileKey`/`nodeId`) de Figma ni confirmes que se envió una notificación si no existe integración real.
- No incluyas secretos en commits.

## Modelo de dominio acordado

Relaciones centrales: `Customer 1—N Order 1—N OrderItem` y `Market 1—N MarketDay`.

- `Customer`: nombre, email y teléfono; la dirección no vive aquí.
- `Order`: código, estado de pago, total, `handedOver`, tokens del formulario y dirección de envío y número de seguimiento opcionales en el pedido.
- `OrderItem`: tipo (`custom`/`finished`), producción, destino, bloque de pintura y datos del formulario.
- `Market`: tipo `market` o `home`, temporada, puesto y coste.
- `MarketDay`: fecha y horarios de apertura/cierre.

El esquema de referencia está en `docs/README.md`; las entidades reales del backend están todavía en evolución. La dirección de la UI mock puede diferir del modelo canónico (en el mock se conserva por ítem; el modelo acordado la ubica en `Order`).

## Mapa del repositorio

- `README.md`: inicio rápido y enlaces principales.
- `docs/reglas-aprendidas.md`: reglas destiladas de todas las correcciones y auditorías; lectura obligatoria.
- `docs/README.md`: contexto, decisiones de producto, límites y modelo canónico.
- `docs/contracts-and-dtos.md`: razones de diseño de DTOs del backend.
- `docs/frontend-api-swap.md`: contrato de los endpoints implementados, compartido por mock y HTTP.
- `docs/figma.md`: referencias de diseño y node IDs conocidos.
- `tasks/todo.md`: backlog activo; mantenerlo coordinado con el estado real.
- `frontend/src/api/contracts.ts`: contratos de servicio que consume la UI.
- `frontend/src/api/mock/`: servicios y almacenamiento demo.
- `frontend/src/api/http/services.ts`: implementación HTTP y subida multipart de fotos para la tienda.
- `frontend/src/domain/types.ts`: tipos usados por la UI mock/API.
- `frontend/src/pages/public/`: Home, tienda, formulario, Track y páginas legales.
- `frontend/src/pages/staff/`: agenda, entregas, mercados, venta, detalle de pedido y pintura.
- `frontend/src/components/staff/`: componentes del flujo de staff.
- `awg-tracking/src/main/java/com/artwithgab/awg_tracking/`: aplicación Spring, DTOs, enums, entidades, mappers, repositorios, servicios y excepciones.

Arranque del frontend (ver también `frontend/README.md`):

```bash
cd frontend
npm install
npm run dev
```

Scripts disponibles en `frontend/package.json`: `dev`, `build`, `build:mock`, `lint` y `preview`. Para comprobaciones y producción: `VITE_DATA_SOURCE=http npm run build`. El build en modo producción falla si la fuente no es `http`, salvo escape explícito `VITE_ALLOW_MOCK_BUILD=1`; `npm run build:mock` lo activa solo para previews locales/E2E y nunca debe desplegarse. Docker conserva `VITE_DATA_SOURCE=http`.

## Escena pública (estilo Santa Tracker)

- Paleta de día de Santa Tracker: tokens `--sky-*`, `--ridge-*` y `--haze` en `styles/tokens.css`. Texto blanco con sombra azul, y casillas del contador azul marino casi opaco para que se lean sobre cualquier fondo.
- Estructura del Home en franjas: cielo con título y contador → puesto sobre la calle (`VillageStreet`) → nieve despejada con los dos botones (solo texto, sin iconos) → pie. Todo comparte una única línea de suelo.
- `HomePage.module.css` define `--stall-w` en `.hero`. De él salen la altura de la calle (13 %) y el tamaño de casas, árboles y personajes, así que las proporciones se mantienen en cualquier pantalla. Las reservas verticales usan tokens de 500/420 px (440 px en desktop), contando el pie legal con salto de línea. Esta corrección del 2026-11-12 está pendiente de verificación visual en los tamaños de 320 a 1920 px.
- `VillageStreet.tsx`: calle a todo el ancho con aceras, calzada y paseantes. Desde 1024 px añade casas, árboles, farola con elfo y figuras a los lados. Cada fila ocupa exactamente el hueco libre junto al puesto y encoge sus piezas en proporción si no caben, así nada queda cortado. Desde 1600 px hay más figuras en la nieve delantera (clase `.wide`). La calle no lleva `contain` ni `z-index` a propósito, para que los paseantes (z 2) queden delante del puesto (z 1).
- `WinterBackdrop.tsx` es `position: fixed` (igual que `Snowfield`), así que en páginas largas no aparecen cortes de color. Contiene el cielo en un solo degradado, la luz del sol, nubes (solo en franjas que no cruzan el título), aerogeneradores, crestas, `FarTown`, `TreeRow` y franjas de neblina (`--haze`) que dan profundidad. Las casas lejanas de la calle llevan opacidad 0,78.
- **Barras de Safari (iOS 26, Liquid Glass):** Safari ignora `theme-color` y tiñe sus barras con el color de cualquier elemento `fixed`/`sticky` que toque el borde (WebKit `LocalFrameView::fixedContainerEdges`). Las capas a pantalla completa con **z-index negativo** se ignoran. Por eso `WinterBackdrop` va con z-index −2 y `Snowfield` con −1, dentro de `.shell` con `isolation: isolate`: así las barras quedan como cristal transparente, igual que en apple.com. No subir esos z-index ni pintar fondos en capas fijas que lleguen al borde. Las páginas públicas hacen scroll del documento (no de un contenedor interno), necesario para que funcione el cristal; `html` lleva `--sky-top` para la barra superior. Responsive Design Mode no emula esto: hay que probarlo en un iPhone real. Al final de un documento corto, bajo la barra inferior de cristal no hay página y Safari pinta el fondo de `html` (azul): por eso `.shell` mide como mínimo `100lvh` (una fila extra con `::after` dejaba un hueco grande tras el pie y se revirtió). **No usar una franja fija/sticky para teñirla**: Safari la vuelve opaca (probado y revertido el 2026-11-11). `WinterBackdrop` y `Snowfield` miden `100lvh` fijos y la escena interior (`.scene`) `100svh`, para que el fondo no cambie de tamaño al esconderse las barras; `html` lleva `overscroll-behavior-y: none`. El fondo de `TrackDialog` no lleva `backdrop-filter`. **Todo esto (2026-11-11) está sin confirmar en iPhone real.**
- Personajes (2026-11-11): `PersonBody` en `FlatFolk.tsx` se redibujó con cabeza grande (r=8), abrigo redondeado con borde de piel y mangas con manoplas; la mano levantada vive en `RAISED_HAND` (la usa `LampElf`). Los paseantes miden 10 % del puesto. El puesto cuenta de qué va el negocio: `SittingCat` en el mostrador, `SittingDog` delante y `Painter` (Gaby con delantal pintando una Kugel en su soporte) a la derecha, incrustados como SVG anidados con `x/y/width/height`. Junto a los botones (desktop) ya no hay arbustos ni brotes: a la izquierda un niño con el muñeco de nieve y bolas (`Snowballs`), a la derecha el yeti, el trineo con regalos (`Sled`) y el reno. Arte propio inspirado en el estilo plano; no copiar piezas de Santa Tracker.
- `CabinScene.tsx` es plano, con `viewBox` `0 0 420 332` y el suelo en y=324. `FlatFolk.tsx` tiene los personajes, `FlatTown.tsx` las casas y los árboles, y `PetFaces.tsx` las caras de gato y perro, compartidas por `PaintingOrnament` y la intro.
- `IntroCurtain.tsx`: fondo de cielo (no verde, para que Safari no deje las barras verdes), dos adornos con gato y perro que se balancean y 4 puntos de carga. Solo aparece al cargar entrando por `/`, dura entre 2 y 3,8 s y se salta con un toque o una tecla. Mientras se muestra, `html[data-intro='on']` pausa la entrada del Home.
- Rendimiento: animaciones solo con `transform`/`opacity`. Las luces dentro de los SVG usan `steps()`, la noria y los aerogeneradores giran por pasos, y la hilera de árboles no se anima. Todo respeta `prefers-reduced-motion`.

## v3.1 (desplegada)

- **Stock numerado (V15):** `market_ornament` y `order_item.market_ornament_id`. Solo se vende desde New sale, con selector en línea centrado en la foto. Wine está disponible y Champagne se muestra como Beige. Fotos JPEG de hasta 5 MB. Cancelar devuelve la pieza a `painted`. Statistics muestra «Non-personalised sold». Errores `MARKET_STOCK_SOLD`, `MARKET_STOCK_NOT_READY`, `MARKET_STOCK_SELL_IN_SALE` y `MARKET_STOCK_CHANGED`.
- **Dos puestos (25–29 nov, V16):** «I'm at» se guarda por dispositivo (`awg-active-market-id`); la recogida persiste en `order_item.handoff_day_id`. El puesto efectivo de pintura se resuelve por `PaintingDay.paintingMarket` («Gaby paints at»), luego el puesto primario abierto (`SHOP_PRIMARY_PICKUP_MARKET_ID`), luego el que abre primero. Pintar y recoger el mismo día exige ese mismo puesto. Las sugerencias excluyen conflictos y cambiar el puesto de pintura con recogidas afectadas devuelve 409 `PAINT_NOT_AT_THIS_MARKET`.
- **Staff en iPad:** navegación New sale y More (Deliveries y Needs attention, con punto rojo para atención), búsqueda en cabecera. Agenda muestra el calendario, con movimiento por pulsación larga, engranaje para horas y capacidad derivada de ellas, tarjeta si Gaby pinta en otro puesto, iconos de mercado por día, tarjetas neutras con etiqueta de estado y nombre del cliente, rastro de sesiones Ready y línea de hora actual encima. Ready libera el tiempo futuro y, el día de pintura, acorta la sesión al siguiente cuarto de hora si termina antes. New sale tiene dos opciones grandes al inicio, confirmación al descartar con Back y progreso 1–2–3. Los diez casos límite viven en `frontend/src/lib/newSaleRules.ts`. Sales muestra el puesto de venta o «Web shop».
- **Österreichische Post (V17, incluye lo que era V18):** 5 € por pedido por defecto. Stock permite editar la tarifa, los días semanales (mar/vie por defecto) y las excepciones por fecha. Los festivos se desplazan al siguiente día laborable. Llegada estimada en 2–3 días laborables, con límite el 23 de diciembre. La recogida ocurre después del último día de pintura. `awg.post.paint-from=2026-11-25` fija el inicio de pintura web por Post y el mínimo para calcular cuándo está listo un paquete. `awg.post.collection-from` queda vacío por defecto. Los adornos terminados solo viajan junto a un personalizado por Post del mismo pedido (`awg.post.finished-with-custom`). Ship en Deliveries agrupa por día de recogida de Correos. El número opcional se añade al marcar «Handed to Post» y enlaza a post.at desde Track y el correo de envío. Los pedidos `vienna` antiguos siguen visibles.
- **Make room:** `POST /api/agenda/blocks/{itemId}/make-room` mueve una sesión elegible y `POST /api/agenda/make-room` libera un hueco con `Idempotency-Key`. Ambos conservan la fecha de entrega o recogida. Ver [contrato de Post](tasks/post-shipping-contract-2026-11-20.md) y [contrato HTTP vigente](docs/frontend-api-swap.md).
- **Verificación de la versión según el registro de entrega:** 270 pruebas de backend, 106 Node y `e2e-full` en verde en CI.

## v3.2.0: correos, revisión y MCP (desplegada 2026-11-22)

- Prueba real en producción: llegaron los 10 correos al cliente. Hallazgos en `tasks/qa-real-tests-2026-11-22.md`; página visual de plantillas: https://claude.ai/artifact/FT1twyvR5Vx9uZ5eZcSNpr.
- Plantillas HTML aprobadas por el dueño: `service/mail/CustomerMailTemplates` (vista) y `CustomerMailComposer` (qué correo toca por evento, uno como máximo). Avisos al dueño siguen en texto en `NotificationService`; `OWNER_EMAIL` admite varias direcciones. Sin datos fiscales no hay comprobante aparte.
- V18: `orders.reviewed_at` (pedido web pagado queda en Needs attention hasta «Mark reviewed», `POST /api/orders/{id}/reviewed`) y `orders.locale` (idioma de los correos).
- Arreglados: script de contraseña (hash sin citar por ssh) y ventas en días con solo «Casa».
- Gmail elimina el SVG en línea: montañas, adornos e íconos de los correos son PNG en `frontend/public/mail/`. Compra web real con 4242 verificada (`AWG5CFZGE`). Los 8 correos al cliente probados en producción (DE/EN). «Cobrar y entregar» es una sola llamada (`collectMethod` en `/handed-over`): un solo correo al cliente.
- Arreglos de la prueba real (hallazgos 12–15 y 24): Track ofrece Instagram y correo, la ficha muestra «Red · Shiny», el panel de pago tras un depósito solo ofrece «Mark paid» y corrige desde el estado real, y en New sale la dirección de Post es opcional si todo lo que va por Post es personalizado (el cliente la pone en el formulario QR). Brevo añade `List-Unsubscribe` y seguimiento de aperturas/clics: no se apaga sin plan Enterprise (pregunta al asesor en `tasks/todo.md`).
- Producción: `OWNER_EMAIL` incluye el correo personal del dueño, `MAIL_REPLY_TO=artwithgab@gmail.com`, `MCP_ENABLED=true` y `MCP_ALLOWED_EMAILS` con las cuentas de Andrés y Gaby.

## Backend actual

- Paquete `com.artwithgab.awg_tracking`. API REST con sesiones staff bearer opacas, PostgreSQL y Flyway **V1–V22** (V20 límite de letras, V21 tamaños y V22 stock por tamaño, pendientes de desplegar) (V18 revisión e idioma, V19 audiencia de sesión MCP; ambas en producción desde 2026-11-22) con `ddl-auto=validate`. V14 guarda precios y recargos por nombre, V15 añade stock numerado, V16 guarda el puesto de recogida y de pintura, y V17 añade Post y los replays de Make room. Los tests usan H2 sin Flyway.
- Cada bloque de pintura se deriva de `OrderItem.paintStart/paintEnd` y usa el ID del ítem. Toda reserva de pintura o stock toma `ScheduleLock` (fila 1). Métricas usan la fila 2. Precios del servidor en `price_setting`, con valores de configuración como respaldo.
- Ventas staff idempotentes. Un checkout web `PENDING` o `REVIEW` ocupa horas como reserva sin datos del cliente en Agenda, queda fuera de Entregas y aparece en Needs attention. Stripe se confirma en el servidor y un importe inesperado requiere revisión.
- Los enlaces de formulario caducan 30 días tras la entrega. `RetentionService` borra fotos y datos personales, incluido el número de envío, 60 días después de entregar o a los 365 días si sigue sin entregar. La lista de espera usa doble opt-in y borra altas sin confirmar a los siete días.
- Seguridad: Track usa un presupuesto global contra enumeración. Los limitadores agrupan IPv6 por /64. Los checkouts sin confirmar no aceptan ediciones públicas ni envían correo al cliente. Los logs SMTP guardan solo clase de excepción y código de estado. Ver [reglas aprendidas](docs/reglas-aprendidas.md).
- Las notificaciones dependen de SMTP. Con datos fiscales configurados, las facturas se guardan con numeración consecutiva y cola de reintento. Si faltan datos fiscales, el correo de pago es una «Zahlungsbestätigung» sin número. Ver [operación y despliegue](docs/deploy.md).
- Arranque dev y pruebas en el [README del backend](awg-tracking/README.md). Los códigos HTTP se traducen en `frontend/src/lib/apiError.ts`.

## Tienda pública y formulario QR

- `/buy` vende adornos personalizados y cobra con Stripe Checkout. Tres pantallas (diseño → entrega/contacto → revisión), con una página por adorno y el nombre opcional del reverso (máx. 5 letras por defecto, editable en Stock desde V20). El cliente elige envío por Post con rango estimado o recogida en mercado con día, hora y enlace de Google Maps. El calendario `.ics` corresponde a recogida.
- En `/form/:token`, el cliente aporta datos y fotos y, cuando corresponde, la dirección. Al guardar abre `/track/:code`; `?staff=1` evita persistir el token en el iPad del puesto. Track muestra el estado del pedido, el rango de Post y el enlace de seguimiento cuando existe, y ofrece contacto por Instagram.
- En ambos formularios la barra de acciones va al final del contenido. La franja de varias Kugeln es sticky en móvil al bajar por el editor. Diseño y copy en [el sistema público](docs/design-system.md) y [las reglas aprendidas](docs/reglas-aprendidas.md).
- `/impressum`, `/agb` y `/datenschutz` publican los textos sin aviso de borrador. El Impressum identifica a la vendedora privada Gabriella Vesovic, Jedleseer Straße 89/36/11, 1210 Wien, `artwithgab@gmail.com`, +43 676 3347163. La política de privacidad identifica a AWS, Cloudflare y Brevo entre los proveedores. Las revisiones pendientes están en [el backlog](tasks/todo.md).

## Servidor MCP (desplegado 2026-11-22)

Conector personalizado de claude.ai para manejar AWG por chat (plan Max, sin costo de API): paquete `mcp` del backend, `/mcp` sin estado, OAuth 2.1 con PKCE contra las cuentas staff, herramientas de lectura y de escritura (estas con `confirm=true`); `get_order` incluye el teléfono del cliente y correo/dirección solo salen por `get_customer_contact`; apagado salvo `MCP_ENABLED=true`. El token del conector es una sesión con `audience = mcp` (V19) que solo abre `/mcp`. En producción y conectado en el claude.ai del dueño; solo entran los correos de `MCP_ALLOWED_EMAILS`. Antes de cualquier rollback, borrar las sesiones `audience = mcp` (ver `tasks/mcp-server-plan-2026-11-22.md` y `tasks/audit-results/mcp-security-2026-11-22.md`).

## Panel de agentes

`scripts/agents/` muestra agentes, uso y horas de reinicio de cuota, último cambio de archivo y la cola «Pendiente». Gestionar la cola con `node scripts/agents/agent-run.mjs pending add|done|list`. Registrar los chats y agentes con `agent-run.mjs run` o `start`/`finish`, y refrescar el uso de Claude al inicio. El panel local usa `localhost:4747` y el estado compartido de `~/.awg-agents/`. Detalles en [agent-routing.md](docs/agent-routing.md).

## Pruebas

- Backend: `cd awg-tracking && ./mvnw test`. Frontend: `npm run lint`, `node --test tests/*.test.mjs` y `VITE_DATA_SOURCE=http npm run build` desde `frontend/`.
- Una clase de prueba con `@TestPropertySource` crea otro contexto de Spring: dale su propia `spring.datasource.url` de H2, o recrea el esquema compartido `awg` y rompe otras pruebas según el orden.
- Playwright usa mock, con `PW_PORT` y `PW_WORKERS` configurables. Las comprobaciones de geometría se validan en CI. Ejecutar `e2e-full` para el commit exacto antes de desplegar. Ver §0.1 de [reglas aprendidas](docs/reglas-aprendidas.md).

## Estado y siguientes tareas

Producción sirve v3.2.0 (`main`). Siguiente tarea: Stripe con claves live. Producción quedó vacía de pedidos (dueño, 2026-11-23): solo el mercado «Casa»; faltan los mercados reales del 25–29 nov. El stock de bases no se recalculó tras borrar los pedidos de prueba antiguos: revisarlo en Stock. Para desplegar, `deploy/deploy.sh` requiere cambios rastreados limpios y CI completo en verde para el commit exacto. SSH usa el puerto 22 del grupo `awg-web`. El dueño ejecuta el script local `deploy/reset-staff-password.sh <email>` para restablecer una contraseña, enviando solo el hash bcrypt como credencial. Ver [operación y despliegue](docs/deploy.md).

Para la base de una rama, el trabajo en paralelo y la revisión cruzada, aplicar [las reglas aprendidas](docs/reglas-aprendidas.md) y [el reparto de agentes](docs/agent-routing.md).

Las comprobaciones de pago y correo y las decisiones abiertas del dueño y el asesor están en [tasks/todo.md](tasks/todo.md).

## Histórico

- v3.0.2 se desplegó el 2026-11-12 con V12–V13. v3.1.0 la sustituyó el 2026-11-20 y v3.2.0 el 2026-11-22.
- Revisiones anteriores de seguridad y UX en [tasks/audit-results/](tasks/audit-results/). El [handoff público de v1.1](docs/v1.1-public-mobile-handoff.md) conserva la evidencia de esa versión.
