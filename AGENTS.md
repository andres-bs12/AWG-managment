# Contexto del proyecto — ArtWithGab (AWG)

**Actualizado:** 2026-11-12 (v3: release/v1.1 integrada, seguridad pre-release, V12/V13, E2E 715 en verde)
**Propósito de este archivo:** memoria persistente para el dueño del proyecto y los agentes que trabajen en este repositorio.

## Instrucción de mantenimiento

Lee este archivo al comenzar una tarea. Después de un cambio importante, actualízalo para reflejar el estado real: decisiones nuevas, trabajo terminado, pendientes, problemas conocidos y cambios locales relevantes. Mantén un resumen útil y conciso; no copies la conversación completa ni dejes como vigente información obsoleta. Antes de describir o cambiar el estado del código, revisa `git status` y los diffs actuales.

No descartes, reviertas ni sobrescribas cambios locales sin confirmar como parte de otra tarea sin una instrucción explícita.

## Proyecto y fase

ArtWithGab es una herramienta para registrar ventas y coordinar la producción y entrega de ornamentos navideños personalizados en los mercados de Viena de 2026. La aplicación tiene una interfaz pública y herramientas de staff.

- **Frontend:** React, TypeScript y Vite, en `frontend/`. Flujos staff cerrados; funciona contra el backend real (`VITE_DATA_SOURCE=http`) o el mock.
- **Backend:** Java 21, Spring Boot 4.1.1 y Maven, en `awg-tracking/`. API REST completa (ver `docs/frontend-api-swap.md`).
- **Base de datos:** PostgreSQL (`DB_URL`/`DB_USERNAME`/`DB_PASSWORD`; local por defecto `awg_tracking`). Tests en H2.
- **Fase:** desde 2026-11-04 el dueño delegó a los agentes la implementación del backend y la integración; se trabaja por sprints con auditoría (código, seguridad, UX/UI) al final de cada uno, y las dudas van a `tasks/preguntas-pendientes.md`.

## Reglas de producto y límites

- **UI pública:** leer y aplicar obligatoriamente `docs/design-system.md` antes de cualquier cambio; `docs/design-system-audit.md` registra la migración pendiente.

- El formulario del cliente recoge datos y fotos; no cobra. El staff confirma manualmente un pago después de verificar que se recibió.
- Estados de pago acordados en la documentación: `unpaid`, `deposit` y `paid`. `deposit` guarda el importe recibido en `amountPaid`: 50 % por defecto, editable a un importe mayor que cero y menor que el total. El saldo se calcula con ese importe real.
- En el puesto no se integra ningún procesador de pagos. **Excepción decidida por el dueño (2026-11-04):** la tienda web pública (`/buy`, solo entrega en Viena) cobra con Stripe Checkout.
- El nombre personalizado en el adorno cuesta 12,99 €. No se puede quitar después del pedido, así que la UI pública ya no muestra un aviso de «sin reembolso» (dueño, 2026-11-12).
- Un pedido puede mezclar adornos `custom` y `finished`. Pintura y recogida/entrega son eventos distintos; comprobar capacidad antes de comprometer un bloque.
- Recogida en mercado: viernes, sábado o domingo. Entrega en Viena: miércoles o viernes. Si un viernes coincide con mercado, tiene prioridad el puesto.
- Capacidad de pintura en casa: lunes, martes y jueves, 3 huecos entre 10:00–13:00; miércoles y viernes, 2 huecos entre 10:00–12:00. Un bloque suele durar 60 minutos, unos 75 si incluye nombre.
- El idioma del staff es inglés; la experiencia pública es alemán/inglés.
- La UI accede a datos solo mediante `frontend/src/api/`. El mock es la fuente predeterminada (`VITE_DATA_SOURCE=mock`); también existe implementación HTTP.
- Dashboard no forma parte de la fase actual. Los e-mails existen pero dependen de SMTP; el stock se edita en `/staff/inventory`. No inventes IDs (`fileKey`/`nodeId`) de Figma ni confirmes que se envió una notificación si no existe integración real.
- No incluyas secretos en commits.

## Modelo de dominio acordado

Relaciones centrales: `Customer 1—N Order 1—N OrderItem` y `Market 1—N MarketDay`.

- `Customer`: nombre, email y teléfono; la dirección no vive aquí.
- `Order`: código, estado de pago, total, `handedOver`, tokens del formulario y dirección de entrega opcional cuando algún ítem usa entrega a Viena.
- `OrderItem`: tipo (`custom`/`finished`), producción, destino, bloque de pintura y datos del formulario.
- `Market`: tipo `market` o `home`, temporada, puesto y coste.
- `MarketDay`: fecha y horarios de apertura/cierre.

El esquema de referencia está en `docs/README.md`; las entidades reales del backend están todavía en evolución. La dirección de la UI mock puede diferir del modelo canónico (en el mock se conserva por ítem; el modelo acordado la ubica en `Order`).

## Mapa del repositorio

- `README.md`: inicio rápido y enlaces principales.
- `docs/README.md`: contexto, decisiones de producto, límites y modelo canónico.
- `docs/contracts-and-dtos.md`: razones de diseño de DTOs del backend.
- `docs/frontend-api-swap.md`: mapa de endpoints sugeridos y trabajo pendiente para cambiar de mocks a HTTP.
- `docs/figma.md`: referencias de diseño y node IDs conocidos.
- `tasks/todo.md`: backlog activo; mantenerlo coordinado con el estado real.
- `frontend/src/api/contracts.ts`: contratos de servicio que consume la UI.
- `frontend/src/api/mock/`: servicios y almacenamiento demo.
- `frontend/src/api/http/services.ts`: implementación HTTP y subida multipart de fotos para la tienda.
- `frontend/src/domain/types.ts`: tipos usados por la UI mock/API.
- `frontend/src/pages/public/`: Home, Buy placeholder, formulario y Track.
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
- **Barras de Safari (iOS 26, Liquid Glass):** Safari ignora `theme-color` y tiñe sus barras con el color de cualquier elemento `fixed`/`sticky` que toque el borde (WebKit `LocalFrameView::fixedContainerEdges`). Las capas a pantalla completa con **z-index negativo** se ignoran. Por eso `WinterBackdrop` va con z-index −2 y `Snowfield` con −1, dentro de `.shell` con `isolation: isolate`: así las barras quedan como cristal transparente, igual que en apple.com. No subir esos z-index ni pintar fondos en capas fijas que lleguen al borde. En móvil la barra sticky de acciones de `/buy` y `/form` flota 8 px por encima del borde (`bottom: var(--space-2)`, esquinas redondeadas y sombra), para que Safari no la tome como borde y deje el cristal. Las páginas públicas hacen scroll del documento (no de un contenedor interno), necesario para que funcione el cristal; `html` lleva `--sky-top` para la barra superior. Responsive Design Mode no emula esto: hay que probarlo en un iPhone real. Al final de un documento corto, bajo la barra inferior de cristal no hay página y Safari pinta el fondo de `html` (azul): por eso `.shell` mide como mínimo `100lvh` (una fila extra con `::after` dejaba un hueco grande tras el pie y se revirtió). **No usar una franja fija/sticky para teñirla**: Safari la vuelve opaca (probado y revertido el 2026-11-11). `WinterBackdrop` y `Snowfield` miden `100lvh` fijos y la escena interior (`.scene`) `100svh`, para que el fondo no cambie de tamaño al esconderse las barras; `html` lleva `overscroll-behavior-y: none`. El fondo de `TrackDialog` no lleva `backdrop-filter`. **Todo esto (2026-11-11) está sin confirmar en iPhone real.**
- Personajes (2026-11-11): `PersonBody` en `FlatFolk.tsx` se redibujó con cabeza grande (r=8), abrigo redondeado con borde de piel y mangas con manoplas; la mano levantada vive en `RAISED_HAND` (la usa `LampElf`). Los paseantes miden 10 % del puesto. El puesto cuenta de qué va el negocio: `SittingCat` en el mostrador, `SittingDog` delante y `Painter` (Gaby con delantal pintando una Kugel en su soporte) a la derecha, incrustados como SVG anidados con `x/y/width/height`. Junto a los botones (desktop) ya no hay arbustos ni brotes: a la izquierda un niño con el muñeco de nieve y bolas (`Snowballs`), a la derecha el yeti, el trineo con regalos (`Sled`) y el reno. Arte propio inspirado en el estilo plano; no copiar piezas de Santa Tracker.
- `CabinScene.tsx` es plano, con `viewBox` `0 0 420 332` y el suelo en y=324. `FlatFolk.tsx` tiene los personajes, `FlatTown.tsx` las casas y los árboles, y `PetFaces.tsx` las caras de gato y perro, compartidas por `PaintingOrnament` y la intro.
- `IntroCurtain.tsx`: fondo de cielo (no verde, para que Safari no deje las barras verdes), dos adornos con gato y perro que se balancean y 4 puntos de carga. Solo aparece al cargar entrando por `/`, dura entre 2 y 3,8 s y se salta con un toque o una tecla. Mientras se muestra, `html[data-intro='on']` pausa la entrada del Home.
- Rendimiento: animaciones solo con `transform`/`opacity`. Las luces dentro de los SVG usan `steps()`, la noria y los aerogeneradores giran por pasos, y la hilera de árboles no se anima. Todo respeta `prefers-reduced-motion`.

## Pre-release security fixes (2026-11-12)

- Implemented H2, M1–M4, L2–L5 and L8 locally, with 162 backend tests passing (startup Byte Buddy agent; Java 25 runtime, compilation target 21). H1 checkout caps and the 15-minute expiry were already present after the merge and are preserved. No changes to `frontend/src`, no commit or staging. Detailed finding → file → test mapping and final test count: `tasks/security-review-fixes-2026-11-12.md`.
- PENDING/REVIEW web orders reject public address/form writes with 409 `PAYMENT_PENDING`, and receive no customer notification mail. Address/form notifications share one event/order/15 minutes with neutral edit greetings. Waitlist mail budgets: 3/client/hour, 30 global/hour, 200 global/day, including resends; exhaustion is checked before subscriber lookup. Budgets are in memory for one backend instance.
- IPv6 limiter clients share /64; login failures are account+client scoped (account-wide 200/minute warns only). After 300 Track misses/hour, all lookups reject before querying until the window expires to stop enumeration. Limiter cleanup runs at most once/minute. Abandon checks the token before the schedule lock and returns 204 for missing/unauthorized orders. SMTP logs contain only exception class and numeric status.
- nginx now defaults to 64 KiB; only exact checkout and forms uploads allow 60 MiB. Webhook checks headers before bounded body reads (256 KiB application limit). JVM heap is capped at 70% of container RAM and exits on OOM; frontend base stays `nginx:1.27-alpine` (L8 pending: `docker pull nginx:1.30-alpine` hangs from this machine; retry before the next release). The 60 MiB limits were raised to 64 MB/64m (Spring + nginx) after GLM's audit; `/api/metrics/buy` also has a 600/min global cap.
- New **V13__metrics_lock.sql** reserves row 2 for metrics, independent from scheduling row 1; V8–V12 are unchanged. Applying V13 to PostgreSQL, building/running containers, real SMTP/Stripe checks and the owner's Cloudflare Track rule (`docs/deploy.md`) remain pending. Independent cross-model audit attempts (Vibe/GLM and Antigravity/Gemini) failed at initialization under this sandbox; no audit approval is claimed.

## Backend actual

Paquete `com.artwithgab.awg_tracking` (con guion bajo; no cambiarlo). Capas: `model`, `repository`, `dto/*` (misma forma que `frontend/src/domain/types.ts`), `service` (lógica portada del mock con los mismos mensajes de error), `controller`, `security` (sesiones bearer opacas con hash, rate limit), `payment/StripeClient` (REST sin SDK), `config` (`AwgProperties`, `Bootstrap`).

- No hay entidad `TimeBlock`: el bloque es `OrderItem.paintStart/paintEnd`, su id es el del ítem. `marketDayId` se resuelve por fecha (gana el puesto).
- Toda operación que reserva tiempo de pintura toma el lock de fila `ScheduleLock` (evita doble reserva y sobreventa de stock).
- Los precios los calcula el servidor (`awg.pricing.*`).
- Pedidos web `PENDING`/`REVIEW` ocupan horas y se muestran como reservas rayadas sin datos del cliente en Agenda; no aparecen como entregas hasta que se confirme el pago. Se encuentran en `/staff/attention`.
- Arranque: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (datos demo y usuarios demo: `gaby@artwithgab.com`/`gaby`, `andres@artwithgab.com`/`andres`). Tests: `./mvnw test` (107 tests; verificados el 2026-11-09 con Byte Buddy como `-javaagent` en el sandbox).
- Esquema con Flyway (`db/migration/V1..V12`), `ddl-auto=validate`; los tests usan H2 sin Flyway. Un cambio de entidad necesita una migración nueva.
- Errores `{status, message, code, field}` con códigos estables (`docs/sprint5-contract.md`); el front los traduce con `frontend/src/lib/apiError.ts`.
- Ventas del staff idempotentes (`Idempotency-Key`). Pago Stripe con importe distinto → `checkoutStatus=REVIEW` (no se libera; el staff lo resuelve al anotar el pago). Cancelar/abandonar cierra la sesión de Stripe (`expireOrReconcile`).
- Stock editable con `expectedQuantity` (409 `STOCK_CHANGED`), días de pintura (`PaintingDay`, máximo 2 por defecto), fin de temporada `awg.shop.season-end` (24-dic), lista de espera.
- Colores `red`/`green`/`beige` (gris y blanco solo para datos antiguos, `CustomColor.isOffered`) con acabado `shiny`/`matte` (`CustomFinish`); stock por color + acabado.
- Entregas web desde `awg.shop.deliveries-from` (30-nov-2026). El enlace del formulario caduca 30 días tras la entrega (`Order.handedOverAt`, `FormLinkPolicy`, 404 `FORM_EXPIRED`). Track oculta nombres para códigos antiguos cortos sin token.
- `RetentionService` (cada noche): borra fotos y datos personales 60 días tras la entrega (365 si nunca se entregó) y la lista de espera sin confirmar a los 7 días. Lista de espera con doble opt-in (`/waitlist/confirm#token`, `/waitlist/unsubscribe#token`).
- E-mails al dueño y al cliente por evento de pedido (`NotificationService`, tras commit, asíncrono); sin `MAIL_HOST` no se envía nada.
- Facturas (2026-11-08, feedback del mercado): e-mail con Rechnung al pagar (Stripe o staff), al registrar depósito (muestra pagado, saldo y fecha/hora de entrega) y al cambiar a pagado o entregar; cada estado es un documento nuevo con número consecutivo (V12; antes V8 en esta rama) que referencia el anterior. Cola persistente, máximo 10 intentos SMTP. **No se emite ninguna factura mientras `awg.invoice.*` (nombre, dirección, nota fiscal) esté vacío o con `[placeholder]`**: en ese caso (el actual, porque el dueño no tiene empresa) se envía una «Zahlungsbestätigung» sin número ni datos fiscales, con asunto «Danke für deine Bestellung · Code …». `ShopConfigDto.confirmationEmail` dice si hay SMTP, y la página de gracias solo menciona el e-mail cuando es `true`. UID opcional. Alemán siempre (no hay locale en pedido). Las facturas no se borran con `RetentionService` (conservación contable: pendiente del asesor). Entrega en Viena con franja fija 18:00–20:00 (`awg.shop.delivery-window-*`, `when.toHour`).
- Contraseñas iniciales del staff: mínimo 10 caracteres fuera de dev. Fotos JPEG/PNG se decodifican antes de guardarse.
- **v3.0.2 desplegada el 2026-11-12** (commit `0ce95bf`, migraciones V12/V13 aplicadas, backup `~/backups/pre-v3.0.2-20261112T0900.sql.gz`). El SSH (security group `awg-web`) se abrió a la IP nueva del dueño ese día; Xcode no está instalado, así que no hay simulador iOS (se usa Playwright WebKit, que no emula el safe-area).
- Despliegue: `docker-compose.yml` + `docs/deploy.md`; nginx con cabeceras de seguridad, sin registrar enlaces `/form/` y con la IP real desde `CF-Connecting-IP`. **En producción desde 2026-11-06:** artwithgab.com (Cloudflare) → AWS EC2 t4g.small en Estocolmo con Caddy; `deploy/deploy.sh` para publicar y `deploy/status.sh` para revisar. **v1.1 desplegada el 2026-11-07** (commit `21137b2`, migraciones hasta V11, backup previo `~/backups/pre-v1.1-final-20261107T1927.sql.gz`). `.env` es solo de root: `deploy.sh`/`status.sh` usan `sudo docker compose`. Pendiente tras el deploy, pospuesto por el dueño: los métodos de pago en el Dashboard, el evento `async_payment_failed` y la compra de prueba 4242 (`docs/checklist-lanzamiento.md`, «Al desplegar la v1.1»). El pago web completo no está verificado en producción.
- Las auditorías usan Codex CLI (`codex exec -s read-only`) como revisor independiente además de subagentes.

## Tienda pública y formulario QR

- Public UI review follow-up (2026-11-12): review Back is always visible (44px text action below the Stripe note on phones); Track address fields have an explicit 24px grid and miss-page dialog openers remain mounted with focus restoration. Clearing a back name resets the preview side. HelpTip/SegmentedControl retain their original staff defaults, with the new help presentation scoped to the public shell. Receipt colours use the shared map with legacy labels and no duplicate painted name. The multi-ornament editor uses a zero-height anchor plus a fixed 64px overlay; sticky-room decisions use that token, and focus clearance measures the overlay. German invalid-email copy updated. TypeScript/lint pass (existing warnings; 26 staff CSS contracts), plus 5 focus tests. No Playwright/browser verification. File map: `tasks/public-ui-review-fixes-2026-11-12.md`. Existing PhotoTiles and ContactFields fixes preserved.

- Public QR form, Track and Home fixes (2026-11-12): plural QR titles, compact header/intro groups, section dividers, message-only error summaries, primary-first mobile review actions, neutral jump tiles and non-duplicated review names. Track uses neutral delivery facts, numbered anonymous named ornaments, formatted back names, one page-level lookup error and a dialog without an empty card behind it. Public shell button/input roles now cover Home, Track and the dialog; inputs are 48px, hints use pretty wrapping and invalid photo tiles show an error border. Home height reserves now account for the wrapping legal footer; its mobile text is at least hint size, with `100lvh` preserved. Mock seed revision 13 includes colour/finish. File mapping and verification: `tasks/public-qr-track-home-fixes-2026-11-12.md`. TypeScript/lint and 40 Node tests passed; no Playwright, browser, viewport or real-iPhone verification was run.

- Public `/buy` delivery/review/thanks fixes (2026-11-12): row-level postcode/city errors with preserved ARIA associations; token-based field/section rhythm, calendar sizing and invalid boundary; equal-height public actions, compact phone bars and Back shown at the review bar’s natural end; neutral date placeholders, concise delivery copy, Where before pickup date/time, shared cart totals and e-mail wrapping. Thanks uses the inline OrnamentLoader, singular/plural ornament copy, 4px timeline detail gaps and a 32px/divider/24px rating separation. Shared Button/Field styling is scoped to public pages; staff defaults are preserved. TypeScript and lint pass with existing warnings; no Playwright or browser/visual verification was run.
- Public `/buy` step 1 fixes (2026-11-12): mobile editor content is visible only while stuck (the h3 stays accessible), desktop actions align with the options/name field, labels reserve selected-weight geometry, and photo/note/help controls use the public tokens. The live preview keeps its ornament key across name toggles; parent side state is authoritative, and the side selector requires a name. TypeScript and lint pass (existing warnings); Playwright and visual checks, including ContactFields and staff SegmentedControl help, were not run per owner instruction.
- Varias Kugeln (2026-11-11, sustituye la lista de tarjetas del 08): con 2 o más, selector «In deiner Bestellung» de fichas lado a lado (`OrnamentOverview`: mini adorno, nombre o «Kugel n», precio; C1 en la abierta; ficha discontinua «+ Kugel» con `#buy-add`). Tocar una ficha cambia el editor sin mover el scroll. La papelera va en la esquina de la ficha abierta (objetivo de 44 px), con aviso «Kugel 2 entfernt · Rückgängig» que conserva fotos hasta cambiar de paso. En móvil/tablet la vista previa grande **no** es sticky (tapaba el formulario): lo pegado es una franja fina `[data-public-sticky]` con mini adorno y «Kugel 2 von 2 – Luna». La validación va Kugel por Kugel en el orden de los campos (`firstError`). Con una sola no hay selector ni franja: solo «Weitere Kugel hinzufügen» al final. `/form` usa el mismo selector como saltos, sin añadir ni quitar. Sin botón de pausa en la vista previa (decisión del dueño; el gato/perro sigue alternando, salvo `prefers-reduced-motion`).
- Nombre (2026-11-11): un nombre pagado en la parte de atrás es también el nombre del animal (`lib/petName.ts`, «LUNA» → «Luna»); **Ya no se pide el nombre del animal** (decisión del dueño, 2026-11-11): solo se pregunta un nombre si se pinta detrás, y ese nombre se guarda también como `petName`; sin nombre pagado, `petName` va vacío (el backend ya no lo exige). El nombre es un Nein/Ja por Kugel. Título del paso 1: «Gestalte deine Kugel» / «Customise your ornament»; con varias, «Gestalte Kugel 1 von 2». «Weitere Kugel» sube al inicio del paso. La revisión da el precio por Kugel.
- Textos públicos (2026-11-08): alemán por defecto (`<html lang>` sigue el idioma), Gaby habla en primera persona sin ser empalagosa («Ich male deine Kugel…»), logística neutra. Franja de entrega en `lib/deliveryWindow.ts` («Mittwoch, 2. Dezember 2026 · 18–20 Uhr», `.ics` con hora). Página de gracias: solo el título, todas las Kugeln lado a lado, código, Track, calendario y valoración 1–5 (se bloquea tras responder). Tabla antes→después en `tasks/ux-writing-2026-11-08.md`.

- `/buy` vende solo adornos personalizados en tres pantallas (diseño → entrega → revisión). **Sin subpasos en móvil (decisión del 2026-11-11):** cada Kugel es una sola página (color, acabado, nombre, fotos) y «Weiter» valida todo el diseño y lleva al primer campo que falte de la primera Kugel incompleta; los subpasos cruzados con varias Kugeln confundían. Colores, stock, precios y fechas vienen de la API. Los campos de texto se guardan en `sessionStorage`; las fotos hay que volver a añadirlas tras recargar. Atrás/Adelante del navegador conserva el formulario.
- Entrega: **Lieferung in Wien** (calendario, dirección, gastos de envío) o **Abholung am Markt** (`deliveryKind: 'market'`, día de mercado + hora `pickupTime` en :00/:30 desde la apertura hasta 30 min antes del cierre; sin dirección ni gastos; `POST /api/shop/pickup-days`, errores `PICKUP_DAY_INVALID`/`PICKUP_TIME_INVALID`; cálculo puro en `lib/pickupTimes.ts`).
- Revisión por tarjetas con un único botón «… ändern» por tarjeta; la URL de checkout solo se acepta si es del mismo origen o de `https://checkout.stripe.com`. Página de gracias con línea de tiempo y `.ics` (Europe/Vienna).
- Barra de acciones: `position: sticky` en CSS (`PublicForm.module.css`), abajo y del ancho de la tarjeta; al final del formulario se integra con ella. La reparación del foco (`lib/publicFormFocus.ts`, `lib/publicScroller.ts`) usa el documento como contenedor de scroll.
- `/form/:token` (QR del puesto, móviles e iPad 820×1180/1180×820) comparte componentes con `/buy`: dos pantallas, resumen de errores con foco y, al guardar, redirección a `/track/CODE` con aviso. El iPad del puesto abre `?staff=1` y no guarda credenciales.
- El único nombre editable es el nombre pagado del reverso, máximo 6 letras tras convertir a mayúsculas, sin truncar; también se guarda como `petName`. La API conserva ambos campos para datos antiguos. El campo independiente de mascota, los cuatro pasos, los subpasos móviles, las tabs antiguas y el botón de pausa de la vista previa de v1.1 están sustituidos por las decisiones del 2026-11-11 descritas arriba.
- El handoff `docs/v1.1-public-mobile-handoff.md` conserva la matriz y la evidencia histórica de v1.1; no describe el layout público vigente ni certifica el merge actual.
- Tokens de formulario (`api/formTokens.ts`): solo se guardan tras un envío correcto o la creación del checkout, como `{token, savedAt}` con caducidad de 45 días. El logout del staff borra `awg-form-token:*`.
- Texto legal de personalizados: pendiente del asesor. No inventarlo.

## Pruebas

- Frontend: `npm run build`, `npm run lint` (con advertencias previas), `node --test tests/*.test.mjs`.
- Capturas de `a11y-visual` regeneradas y revisadas a ojo el 2026-11-11 tras el rediseño (`buy.spec.ts-snapshots` está vacío). Suite del 2026-11-11: 462/470 antes de regenerar (solo fallaban esas capturas); backend `./mvnw test` en verde. Chromium de Playwright instalado el 2026-11-11.
- Pantalla de carga pública (2026-11-11): `OrnamentLoader` usa las bolas con gato y perro del telón (`PetBauble.tsx`) y los 4 puntos; `variant="screen"` en el `RouteFallback` de `App.tsx`, `inline` dentro de las tarjetas.
- E2E: `npx playwright test` en modo mock, puerto 5199 (`reuseExistingServer: false`; si el puerto queda ocupado, matar el Vite sobrante). Proyectos: mobile 360, tablet 768, desktop 1280, iPad vertical/horizontal (solo specs de form, pickup, journey y layout) y movimiento reducido. También se conservan las matrices de teléfono de v1.1 y los proyectos staff 360×640/440×741; sus resultados históricos no certifican este merge. axe con wcag22aa en cada pantalla.
- Capturas visuales (`a11y-visual.spec.ts-snapshots`, `maxDiffPixelRatio` 0,02): una captura antigua puede pasar por error. Cuando cambie la UI, borrarlas, regenerarlas y revisarlas a ojo una por una. No inventar tolerancias.
- Codex no puede abrir puertos: Claude ejecuta Playwright y el navegador; Codex implementa o revisa.

## Estado y siguientes tareas

Rama de este worktree: `feat/backend-domain`; incorpora las funciones de `release/v1.1` que están en producción. El merge se prepara sin commit ni push. Sprints 1–5 terminados con auditoría doble (`tasks/audit-final.md`). En el sprint 6 se hicieron:
- el rediseño UX de `/buy` y `/form`, con la recogida en mercado;
- la capa de diseño del staff, con sus arreglos P0/P1;
- el endurecimiento de seguridad: locking optimista `@Version` (V7), puerto de nginx solo en loopback, tokens con caducidad, build de producción solo HTTP y CORS con `Idempotency-Key`.

Informes en `tasks/audit-results/`. Backlog en `tasks/todo.md`; decisiones del dueño en `tasks/preguntas-pendientes.md`.

Forma de trabajo: Opus actúa como project manager (decisión del dueño, 2026-11-11): planifica, delega, revisa y verifica. Reparto (Codex astra/sol/terra solo si tiene créditos; Gemini 3.8 Flash por el CLI de Antigravity `agy`; GLM-5.3 y DeepSeek V4.1 Flash por Mistral Vibe; Claude Fable 5.2 solo como último recurso, cuando ni un subagente Opus ni Codex sol puedan resolverlo (hasta el sábado 2026-11-14); los modelos propios de Mistral no se usan) y el registro de resultados están en `docs/agent-routing.md`, que se actualiza tras cada delegación. Siempre `< /dev/null`. Nunca audita el mismo LLM que escribió el código.

Staff (auditorías del 2026-11-05 `staff-ux-sale-orders-*` y `staff-ux-agenda-ops-*`): P0 y todos los P1 corregidos, junto con la mayoría de los P2. Cambios principales:
- botones grandes de 56 px: la regla global `[data-staff-page]` ya no usa `:is()` con el selector de `input`;
- entregas agrupadas por pedido y con fecha;
- días de pintura con guardado automático;
- agenda escalable con el tamaño del texto;
- conflictos de día marcados en el editor de mercados;
- diálogos con «Not yet» como única forma de cerrar sin actuar.

Codex hizo la revisión cruzada (`tasks/audit-results/codex-review-staff-*.md`) y sus hallazgos están corregidos. Lo pendiente está en `tasks/todo.md`. Validación histórica previa a estos arreglos móviles: E2E 429 casos en verde; backend 95 tests. No certifica la nueva suite móvil.


## v1.1 integrada y migraciones (2026-11-12)

- Se conservan las migraciones de producción **V8__item_handover, V9__soft_cancel_orders, V10__pending_checkout_client y V11__painting_hours sin cambios**; ya están aplicadas. No se editan ni se reutilizan sus números. La migración local de facturas pasa de `V8__invoices.sql` a **`V12__invoices.sql`**; su aplicación en PostgreSQL y el envío SMTP real siguen pendientes.
- Agenda mantiene la franja única de días, límite diario y edición con engranaje de horas/capacidad. Las horas de pintura (V11) son distintas de las de recogida; sugerencias y colocación manual respetan la ventana editada y las reservas existentes siguen visibles fuera de ella.
- Entrega por ítem (V8), selección por lotes y deshacer por ítem; el pedido se entrega y empieza la caducidad del enlace al entregar el último ítem. Los pedidos antiguos entregados se rellenan por migración.
- Cancelación suave (V9): conserva pedido y motivo opcional, devuelve stock elegible, excluye reservas, Track muestra cancelado y retención borra el motivo.
- Límite de **2 checkouts pendientes por cliente**, identificado por hash de la IP que llega a `request.getRemoteAddr()`, y reserva de **15 minutos** (V10, `PENDING_CHECKOUT_LIMIT`). Las sesiones Stripe caducan o se reconcilian cada minuto. Mantener la IP real en el proxy; la compra Stripe completa y la integración del merge en producción no quedan verificadas por conservar estas funciones.
- Staff conserva el overhaul, Sales, filtros, QR con polling y recibo de formulario descritos abajo; la UI pública conserva el editor de una página, fichas y correcciones Safari/píxel de esta rama. La verificación del merge se registra por separado de los checkpoints históricos.


## Staff mobile overhaul (2026-11-06; implementación incorporada desde v1.1)

- Funciones conservadas al integrar v1.1; los límites de verificación y resultados siguientes son históricos del 2026-11-06, no resultados del merge actual. Las migraciones V8–V11 ya están aplicadas en producción.
- Agenda removes repeated date/select/Day/subtitle text. List and Calendar show each paint item's identity and order code, link to the order, and keep existing bookings visible when hours shrink. The day-specific gear opens autosaved hours, open/closed and maximum; warnings preserve bookings over the limit. V11 adds nullable painting-hour overrides; it does not change pickup hours.
- Deliveries uses one cart per order, retaining every item's handoff date/time and per-item controls inside the cart. Filters select carts; other matching cart items remain visible but their controls are disabled outside the active filters. Batch defaults and route remaining counts respect those filters; existing confirmations, item undo and balance collection remain.
- `/staff/sales` (More) lists latest sales with payment/checkout state, source, Vienna created date, search, Today/7 days/All and pagination. Authenticated `GET /api/orders` accepts `state/source/from/to/page/size/query`; existing code lookup remains. Mock/HTTP implement the same contract.
- QR bug fixed: New sale previously never re-fetched its saved order. It now polls serially every 5 seconds, backs off to 30 seconds on failures, and shows **Form received**. Confirmed public submit replaces review with Track, focuses the saved notice and bypasses its blocking wipe. No remaining customer-save data-loss defect was reproduced from source; production symptom needs a real flow check.
- AWG links to Agenda; More includes Sales. Staff summaries remove repeated service schedules, slot availability/durations and colour text beside swatches. Item production/handover groups are separated; dismiss buttons remain **Not yet**.
- Los arreglos públicos de esta entrega se conservan solo cuando son compatibles con las decisiones públicas posteriores. Las capturas de la rama actual son la base y deberán regenerarse y revisarse; no se relajan tolerancias ni reglas axe.
- Verified locally: HTTP build, lint (existing warnings), **50 Node tests**, **119 backend tests** with Byte Buddy. New `staff-phone-360x640` and `staff-phone-440x741` projects cover the mobile overhaul; QR/search/sales and existing staff specs are updated. Browser/E2E and Safari were not run. E2E standalone type checking still hits the existing axe/Playwright Page mismatch in `e2e/helpers.ts`.
- Independent review by `gpt-6-sol` found mock hour parity and scoped/partial handover issues, all fixed and re-reviewed. Codex CLI audit could not initialize its app server in this sandbox (`Operation not permitted`); no CLI audit result is claimed. Findings, commands and remaining validation: `tasks/audit-results/staff-ux-mobile-2026-11-06.md`.

## Full E2E repair (2026-11-06; historical checkpoint)

Superseded baseline: the owner reports **681 E2E passed** before the staff phone polish below. The earlier failures and repair commands remain historical evidence.

- **Partial, no commit:** Claude ran 681 cases: 639 passed, 40 failed, 2 skipped. This supersedes the earlier unrun-browser checkpoint above; the repaired suite has not been re-run. Every failing test, classification, fix and snapshot is recorded in `tasks/audit-results/e2e-repair-2026-11-06.md`.
- Test fixes: optional Intl weekday comma in staff selectors, legacy form API patch survives same-document routing, QR backoff failure injected after mount with controlled clock, precise HelpTip geometry accounts for subpixel rounding. Three route-sweep failures were `ENOSPC`; no timeout or assertion was relaxed.
- Product fixes: Track's reading surface remains opaque throughout entrance (immediate axe after QR save); Agenda's missing photo becomes an accessible swatch without a repeated colour word or empty placeholder; production filters select delivery items before retaining their whole cart and scope actions/default batch IDs.
- Verified this pass: HTTP build, lint (existing warnings), 50 Node tests and E2E syntax checks. The existing axe/Playwright `Page` type mismatch remains. No Java edits/tests this pass; Claude's NUL guard, quarter-hour validation, SalesPage clamp and staged hotfixes retained.
- Claude must re-run behavior, regenerate/review all design/delivery/details/review snapshots for mobile/tablet/desktop and run the full suite. Expected collection 683 with the new filter test on two staff phones. Screenshot tolerance and axe rules unchanged. Safari remains pending; V8–V11 were subsequently applied in production, while V12 and the merged deployment still need PostgreSQL validation.


## Staff phone polish (2026-11-06)

- Implemented locally, **partial until Claude runs Playwright and reviews fresh staff screenshots**. No commit; all previous changes retained. Incoming baseline from owner: 681 E2E passed; this pass does not certify a new green result.
- Bottom tabs use equal columns and padding that outranks selected-button rules; compact visible labels Deliver/Sale retain accessible Deliveries/New sale names. Targets remain at least 44px; 56px large actions and Not yet dialogs unchanged.
- Below 768px Deliveries and Sales disclose Filters (active count). Delivery day and sales search remain inline; filter semantics, URL params and desktop controls preserved. Inventory groups finishes under one accessible colour swatch, with separate saves/conflict handling; html/body use the staff canvas through the scroll extent.
- New sale removes the redundant question heading. StaffText binds separators to the preceding word in handoff, search/sales, agenda, order/sale summaries, markets, painting days and painting metadata; Agenda status arrows stay attached.
- `staff-mobile.spec.ts` adds navigation geometry at 320–440px, fully visible initial results at 360×640, disclosure/count/URL assertions, grouped-stock saves/background and rendered separator-line checks. Sales/staff-review selectors follow the disclosure and inventory grouping. Fresh screenshots change on staff routes; public snapshot files were not edited.
- Local validation and the complete handoff are in `tasks/audit-results/staff-phone-polish-2026-11-06.md`. Browser/Safari and all new Playwright assertions remain for Claude.

## Public form vertical rhythm (2026-11-07; checkpoint histórico)

- Checkpoint anterior a las revisiones del 2026-11-11/12. Se preservan las reglas de ritmo y su evidencia; los subpasos, tabs y la pantalla separada de datos de ese handoff ya no son vigentes. La matriz y las capturas actuales deben seguir el flujo público de tres pantallas.
- Public `/buy` and `/form` use existing tokens: label/control 8px (`space-2`), field/action gap 24px (`space-5`), section gap 32px (`space-6`), heading/body and card-list gap 16px (`space-4`). The divider is centred inside the 32px gap, superseding the old additive 57px rule in the design system.
- Contact fields have no trailing margins; row parents own gaps and retain desktop pairs plus aligned postcode/city. `/buy` removes the duplicate Kontakt heading; QR retains its useful contact heading. The photo substep hides its empty choice wrapper; tabs/add wrap without extra toolbar padding; optional notes have no trailing inline baseline space.
- Shared `ReviewProduct` places artwork, finish/reference photos and price in one top-aligned row in both reviews. Delivery groups and review/terms use parent gaps. Card-bottom padding cancellation and sticky action behaviour, payment wrapping, contrast and footer are preserved.
- HTTP build, lint (existing warnings) and 50 Node tests pass. Playwright discovers 166 cases in layout/design-system/form; browser execution remains for Claude. New layout assertion measures the final details gap at 390×844 as 24 ±2px. Regenerate/review all 12 design/delivery/details/review × mobile/tablet/desktop snapshots without changing tolerance. Files and commands: `tasks/audit-results/public-form-rhythm-2026-11-07.md`.

## Integración de release/v1.1 (2026-11-12)

- Contenido de conflictos resuelto en el worktree de `feat/backend-domain`; se conservan la UI pública reciente y las funciones staff/backend de producción. V8–V11 son idénticas a `release/v1.1`; facturas movidas a V12 sin cambiar el SQL.
- Verificación: backend 131 tests con Byte Buddy como agente de inicio (autoattach de Mockito bloqueado en sandbox); TypeScript/lint y 61 tests Node pasan. Sin ejecución de Playwright, PostgreSQL ni iPhone real.
- Merge commit `b008af1`; detalle en `tasks/merge-release-v1.1-2026-11-12.md`. Tras el merge y la seguridad: backend en verde, Postgres local con V1–V13 aplicadas y arranque OK, E2E completa 715 passed / 2 skipped (WebKit instalado; se arregló el host de `TrackDialog`), build/lint/61 Node en verde. Etiqueta `v3.0`.
