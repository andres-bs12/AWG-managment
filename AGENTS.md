# Contexto del proyecto — ArtWithGab (AWG)

**Actualizado:** 2026-11-07 (v1.1; public form rhythm y staff phone polish pendientes de navegador)
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
- El nombre personalizado en el adorno cuesta 12,99 €. Si se quita, no hay reembolso.
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
- Estructura del Home en franjas: cielo con título y contador → puesto sobre la calle (`VillageStreet`) → nieve despejada con los dos botones → pie. Todo comparte una única línea de suelo.
- `HomePage.module.css` define `--stall-w` en `.hero`. De él salen la altura de la calle (13 %) y el tamaño de casas, árboles y personajes, así que las proporciones se mantienen en cualquier pantalla. En teléfonos (<768 px), `--layout-home-reserve` reserva 424 px para cabecera, texto, contador y ambos CTA; la escena usa el espacio restante de `100svh`, con un mínimo de 64 px y scroll del documento en pantallas más cortas. La nueva matriz de Safari todavía requiere verificación de navegador.
- `VillageStreet.tsx`: calle a todo el ancho con aceras, calzada y paseantes. Desde 1024 px añade casas, árboles, farola con elfo y figuras a los lados. Cada fila ocupa exactamente el hueco libre junto al puesto y encoge sus piezas en proporción si no caben, así nada queda cortado. Desde 1600 px hay más figuras en la nieve delantera (clase `.wide`). La calle no lleva `contain` ni `z-index` a propósito, para que los paseantes (z 2) queden delante del puesto (z 1).
- `WinterBackdrop.tsx` es `position: fixed` (igual que `Snowfield`), así que en páginas largas no aparecen cortes de color. Contiene el cielo en un solo degradado, la luz del sol, nubes (solo en franjas que no cruzan el título), aerogeneradores, crestas, `FarTown`, `TreeRow` y franjas de neblina (`--haze`) que dan profundidad. Las casas lejanas de la calle llevan opacidad 0,78.
- `CabinScene.tsx` es plano, con `viewBox` `0 0 420 332` y el suelo en y=324. `FlatFolk.tsx` tiene los personajes, `FlatTown.tsx` las casas y los árboles, y `PetFaces.tsx` las caras de gato y perro, compartidas por `PaintingOrnament` y la intro.
- `IntroCurtain.tsx`: fondo verde como el loader de Track, dos adornos con gato y perro que se balancean y 4 puntos de carga. Solo aparece al cargar entrando por `/`, dura entre 2 y 3,8 s y se salta con un toque o una tecla. Mientras se muestra, `html[data-intro='on']` pausa la entrada del Home.
- Rendimiento: animaciones solo con `transform`/`opacity`. Las luces dentro de los SVG usan `steps()`, la noria y los aerogeneradores giran por pasos, y la hilera de árboles no se anima. Todo respeta `prefers-reduced-motion`.

## Backend actual

Paquete `com.artwithgab.awg_tracking` (con guion bajo; no cambiarlo). Capas: `model`, `repository`, `dto/*` (misma forma que `frontend/src/domain/types.ts`), `service` (lógica portada del mock con los mismos mensajes de error), `controller`, `security` (sesiones bearer opacas con hash, rate limit), `payment/StripeClient` (REST sin SDK), `config` (`AwgProperties`, `Bootstrap`).

- No hay entidad `TimeBlock`: el bloque es `OrderItem.paintStart/paintEnd`, su id es el del ítem. `marketDayId` se resuelve por fecha (gana el puesto).
- Toda operación que reserva tiempo de pintura toma el lock de fila `ScheduleLock` (evita doble reserva y sobreventa de stock).
- Los precios los calcula el servidor (`awg.pricing.*`).
- Pedidos web `PENDING`/`REVIEW` ocupan horas y se muestran como reservas rayadas sin datos del cliente en Agenda; no aparecen como entregas hasta que se confirme el pago. Se encuentran en `/staff/attention`.
- Arranque: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (datos demo y usuarios demo: `gaby@artwithgab.com`/`gaby`, `andres@artwithgab.com`/`andres`). Tests: `./mvnw test` (95 tests; verificados el 2026-11-05 con Byte Buddy como `-javaagent` en el sandbox).
- Esquema con Flyway (`db/migration/V1..V4`), `ddl-auto=validate`; los tests usan H2 sin Flyway. Un cambio de entidad necesita una migración nueva.
- Errores `{status, message, code, field}` con códigos estables (`docs/sprint5-contract.md`); el front los traduce con `frontend/src/lib/apiError.ts`.
- Ventas del staff idempotentes (`Idempotency-Key`). Pago Stripe con importe distinto → `checkoutStatus=REVIEW` (no se libera; el staff lo resuelve al anotar el pago). Cancelar/abandonar cierra la sesión de Stripe (`expireOrReconcile`).
- Stock editable con `expectedQuantity` (409 `STOCK_CHANGED`), días de pintura (`PaintingDay`, máximo 2 por defecto), fin de temporada `awg.shop.season-end` (24-dic), lista de espera.
- Colores `red`/`green`/`beige` (gris y blanco solo para datos antiguos, `CustomColor.isOffered`) con acabado `shiny`/`matte` (`CustomFinish`); stock por color + acabado.
- Entregas web desde `awg.shop.deliveries-from` (30-nov-2026). El enlace del formulario caduca 30 días tras la entrega (`Order.handedOverAt`, `FormLinkPolicy`, 404 `FORM_EXPIRED`). Track oculta nombres para códigos antiguos cortos sin token.
- `RetentionService` (cada noche): borra fotos y datos personales 60 días tras la entrega (365 si nunca se entregó) y la lista de espera sin confirmar a los 7 días. Lista de espera con doble opt-in (`/waitlist/confirm#token`, `/waitlist/unsubscribe#token`).
- E-mails al dueño y al cliente por evento de pedido (`NotificationService`, tras commit, asíncrono); sin `MAIL_HOST` no se envía nada.
- Contraseñas iniciales del staff: mínimo 10 caracteres fuera de dev. Fotos JPEG/PNG se decodifican antes de guardarse.
- Despliegue: `docker-compose.yml` + `docs/deploy.md`; nginx con cabeceras de seguridad, sin registrar enlaces `/form/` y con la IP real desde `CF-Connecting-IP`. **En producción desde 2026-11-06:** artwithgab.com (Cloudflare) → AWS EC2 t4g.small en Estocolmo con Caddy; `deploy/deploy.sh` para publicar y `deploy/status.sh` para revisar. Tienda (`SHOP_ENABLED`), Stripe y SMTP aún sin configurar en el servidor.
- Las auditorías usan Codex CLI (`codex exec -s read-only`) como revisor independiente además de subagentes.

## Tienda pública y formulario QR

- `/buy` vende solo adornos personalizados en cuatro pantallas (diseño con subpasos móviles → entrega → datos del cliente → revisión). Colores, stock, precios y fechas vienen de la API. Los campos de texto se guardan en `sessionStorage`; las fotos hay que volver a añadirlas tras recargar. Atrás/Adelante del navegador conserva el formulario.
- Entrega: **Lieferung in Wien** (calendario, dirección, gastos de envío) o **Abholung am Markt** (`deliveryKind: 'market'`, día de mercado + hora `pickupTime` en :00/:30 desde la apertura hasta 30 min antes del cierre; sin dirección ni gastos; `POST /api/shop/pickup-days`, errores `PICKUP_DAY_INVALID`/`PICKUP_TIME_INVALID`; cálculo puro en `lib/pickupTimes.ts`).
- Revisión por tarjetas con un único botón «… ändern» por tarjeta; la URL de checkout solo se acepta si es del mismo origen o de `https://checkout.stripe.com`. Página de gracias con línea de tiempo y `.ics` (Europe/Vienna).
- Páginas públicas: scroll del documento, shell sin altura fija ni scroller interno; fondo de escena en html/body y shell con mínimo `100dvh`. Barra de acciones: CSS `position: sticky; bottom: 0` dentro de la tarjeta, safe area inferior; el hook `usePublicActions` y el dock medido se eliminaron. El foco se repara con `window.scrollBy`, sin inferir teclado a partir de las barras de Safari. La vista previa móvil queda en flujo normal. Con altura ≤640 px las acciones son estáticas al final de la tarjeta, independientemente del foco.
- `/form/:token` (QR del puesto, móviles e iPad 820×1180/1180×820) comparte componentes con `/buy`: dos pantallas, resumen de errores con foco y, al guardar, redirección a `/track/CODE` con aviso. El iPad del puesto abre `?staff=1` y no guarda credenciales.
- Con nombre pintado hay un solo control editable: la tarjeta de nombre en `/buy` y el campo único de `/form`. El paso de fotos muestra el nombre sin editar y «Change» vuelve a la tarjeta. Cada edición explícita de `petName` deriva `backName`, incluso al vaciarlo; al cargar datos antiguos se conserva el `backName` existente y solo se deriva si falta (por ejemplo, mascota «Luna Belle» y nombre pintado «LUNA»). El control muestra ese nombre pintado conservado. Máximo 6 letras después de convertir a mayúsculas; cliente y servidor rechazan el exceso, sin truncar. La API conserva ambos campos y sus errores apuntan al mismo control.
- Entrega separa método y fecha («Wann?»/«When?»), con iconos de reparto, puesto y calendario. Contacto/dirección viven en el paso de datos; recogida solo pide contacto. Revisión e historial admiten cuatro pasos; el borrador no guarda `buyStep` porque recargar vuelve al diseño para añadir fotos. «Back» cancela el retorno directo a revisión. Mock y HTTP envían `details` sin transformación; el backend ya permite ese paso.
- Tabs de adornos con número y nombre; filas que envuelven y botón de añadir con texto visible. Pausa de la vista previa identificada con botón circular de 44 px.
- Arreglos móviles v1.1 implementados, **parcial: navegador y Safari real pendientes**. Build HTTP, lint (avisos previos) y 42 tests Node pasan; también los 107 tests backend con Byte Buddy. Los diez hallazgos de revisión móvil están corregidos localmente. Suite `e2e/public-mobile.spec.ts` escrita para los once tamaños del dueño (WebKit; Android en Chromium); no ejecutada aquí. Ver `docs/v1.1-public-mobile-handoff.md` para comandos, capturas y límites de verificación.
- Tokens de formulario (`api/formTokens.ts`): solo se guardan tras un envío correcto o la creación del checkout, como `{token, savedAt}` con caducidad de 45 días. El logout del staff borra `awg-form-token:*`.
- Texto legal de personalizados: pendiente del asesor. No inventarlo.

## Pruebas

- Frontend: `npm run build`, `npm run lint` (con advertencias previas), `node --test tests/*.test.mjs`.
- E2E: `npx playwright test` en modo mock, puerto 5199 (`reuseExistingServer: false`; si el puerto queda ocupado, matar el Vite sobrante). Proyectos: mobile 360, tablet 768, desktop 1280, iPad vertical/horizontal (solo specs de form, pickup, journey y layout) y movimiento reducido. La suite `public-mobile.spec.ts` tiene once proyectos `phone-WxH` adicionales (WebKit, salvo Android en Chromium). axe con wcag22aa en cada pantalla.
- Capturas visuales (`a11y-visual.spec.ts-snapshots`, `maxDiffPixelRatio` 0,02): una captura antigua puede pasar por error. Cuando cambie la UI, borrarlas, regenerarlas y revisarlas a ojo una por una. No inventar tolerancias.
- Codex no puede abrir puertos: Claude ejecuta Playwright y el navegador; Codex implementa o revisa.

## Estado y siguientes tareas

Rama de este worktree: `release/v1.1`. Sprints 1–5 terminados con auditoría doble (`tasks/audit-final.md`). En el sprint 6 se hicieron:
- el rediseño UX de `/buy` y `/form`, con la recogida en mercado;
- la capa de diseño del staff, con sus arreglos P0/P1;
- el endurecimiento de seguridad: locking optimista `@Version` (V7), puerto de nginx solo en loopback, tokens con caducidad, build de producción solo HTTP y CORS con `Idempotency-Key`.

Informes en `tasks/audit-results/`. Backlog en `tasks/todo.md`; decisiones del dueño en `tasks/preguntas-pendientes.md`.

Forma de trabajo: Codex CLI (`gpt-6.1-terra`/`sol`, esfuerzo high para implementar, medium/high para auditar; siempre `< /dev/null`) y Claude para backend delicado, integración y navegador. Nunca audita el mismo LLM que escribió el código.

Staff (auditorías del 2026-11-05 `staff-ux-sale-orders-*` y `staff-ux-agenda-ops-*`): P0 y todos los P1 corregidos, junto con la mayoría de los P2. Cambios principales:
- botones grandes de 56 px: la regla global `[data-staff-page]` ya no usa `:is()` con el selector de `input`;
- entregas agrupadas por pedido y con fecha;
- días de pintura con guardado automático;
- agenda escalable con el tamaño del texto;
- conflictos de día marcados en el editor de mercados;
- diálogos con «Not yet» como única forma de cerrar sin actuar.

Codex hizo la revisión cruzada (`tasks/audit-results/codex-review-staff-*.md`) y sus hallazgos están corregidos. Lo pendiente está en `tasks/todo.md`. Validación histórica previa a estos arreglos móviles: E2E 429 casos en verde; backend 95 tests. No certifica la nueva suite móvil.


## AWG 1.1 work in progress (2026-11-06)

- Partial, uncommitted: Agenda keeps a single day strip and opens that day's painting hours/capacity with a gear. Painting hours are separate from market pickup hours (V11); automatic suggestions and manual placements respect the edited window, while existing bookings remain visible even outside it. Browser and PostgreSQL migration verification remain pending.
- Item-level handover implemented with migration V8, batch selection, item undo and last-item expiry; Playwright and visual verification remain pending. Existing handed-over orders are backfilled.
- Soft cancellation in progress with V9: records and optional reason retained, eligible stock returned, slots excluded, Track shows cancelled and retention clears the reason. Browser verification remains pending.
- Pending checkout limits and 15-minute application expiry implemented with V10 and `PENDING_CHECKOUT_LIMIT`; Stripe sessions are expired/reconciled by the minute. PostgreSQL migration, live Stripe and browser verification remain pending. No new error code was introduced for item handover or cancellation. Do not treat version 1.1 as complete.


## Staff mobile overhaul (2026-11-06)

- Implementation complete locally; **partial until Claude runs the browser matrix**. No commit. Existing public mobile work and Claude's staged OrderService/StripeClient hotfix retained.
- Agenda removes repeated date/select/Day/subtitle text. List and Calendar show each paint item's identity and order code, link to the order, and keep existing bookings visible when hours shrink. The day-specific gear opens autosaved hours, open/closed and maximum; warnings preserve bookings over the limit. V11 adds nullable painting-hour overrides; it does not change pickup hours.
- Deliveries uses one cart per order, retaining every item's handoff date/time and per-item controls inside the cart. Filters select carts; other matching cart items remain visible but their controls are disabled outside the active filters. Batch defaults and route remaining counts respect those filters; existing confirmations, item undo and balance collection remain.
- `/staff/sales` (More) lists latest sales with payment/checkout state, source, Vienna created date, search, Today/7 days/All and pagination. Authenticated `GET /api/orders` accepts `state/source/from/to/page/size/query`; existing code lookup remains. Mock/HTTP implement the same contract.
- QR bug fixed: New sale previously never re-fetched its saved order. It now polls serially every 5 seconds, backs off to 30 seconds on failures, and shows **Form received**. Confirmed public submit replaces review with Track, focuses the saved notice and bypasses its blocking wipe. No remaining customer-save data-loss defect was reproduced from source; production symptom needs a real flow check.
- AWG links to Agenda; More includes Sales. Staff summaries remove repeated service schedules, slot availability/durations and colour text beside swatches. Item production/handover groups are separated; dismiss buttons remain **Not yet**.
- Public E2E fixes A–C: footer has its own opaque snow band; brand uses a contrasting local surface; HelpTip is a 24px info SVG in a 44px target; named-control helper follows the single control. Public snapshots need fresh regeneration and visual review; no tolerance or axe rule was relaxed.
- Verified locally: HTTP build, lint (existing warnings), **50 Node tests**, **119 backend tests** with Byte Buddy. New `staff-phone-360x640` and `staff-phone-440x741` projects cover the mobile overhaul; QR/search/sales and existing staff specs are updated. Browser/E2E and Safari were not run. E2E standalone type checking still hits the existing axe/Playwright Page mismatch in `e2e/helpers.ts`.
- Independent review by `gpt-6-sol` found mock hour parity and scoped/partial handover issues, all fixed and re-reviewed. Codex CLI audit could not initialize its app server in this sandbox (`Operation not permitted`); no CLI audit result is claimed. Findings, commands and remaining validation: `tasks/audit-results/staff-ux-mobile-2026-11-06.md`.

## Full E2E repair (2026-11-06; historical checkpoint)

Superseded baseline: the owner reports **681 E2E passed** before the staff phone polish below. The earlier failures and repair commands remain historical evidence.

- **Partial, no commit:** Claude ran 681 cases: 639 passed, 40 failed, 2 skipped. This supersedes the earlier unrun-browser checkpoint above; the repaired suite has not been re-run. Every failing test, classification, fix and snapshot is recorded in `tasks/audit-results/e2e-repair-2026-11-06.md`.
- Test fixes: optional Intl weekday comma in staff selectors, legacy form API patch survives same-document routing, QR backoff failure injected after mount with controlled clock, precise HelpTip geometry accounts for subpixel rounding. Three route-sweep failures were `ENOSPC`; no timeout or assertion was relaxed.
- Product fixes: Track's reading surface remains opaque throughout entrance (immediate axe after QR save); Agenda's missing photo becomes an accessible swatch without a repeated colour word or empty placeholder; production filters select delivery items before retaining their whole cart and scope actions/default batch IDs.
- Verified this pass: HTTP build, lint (existing warnings), 50 Node tests and E2E syntax checks. The existing axe/Playwright `Page` type mismatch remains. No Java edits/tests this pass; Claude's NUL guard, quarter-hour validation, SalesPage clamp and staged hotfixes retained.
- Claude must re-run behavior, regenerate/review all design/delivery/details/review snapshots for mobile/tablet/desktop and run the full suite. Expected collection 683 with the new filter test on two staff phones. Screenshot tolerance and axe rules unchanged; Safari and PostgreSQL remain pending.


## Staff phone polish (2026-11-06)

- Implemented locally, **partial until Claude runs Playwright and reviews fresh staff screenshots**. No commit; all previous changes retained. Incoming baseline from owner: 681 E2E passed; this pass does not certify a new green result.
- Bottom tabs use equal columns and padding that outranks selected-button rules; compact visible labels Deliver/Sale retain accessible Deliveries/New sale names. Targets remain at least 44px; 56px large actions and Not yet dialogs unchanged.
- Below 768px Deliveries and Sales disclose Filters (active count). Delivery day and sales search remain inline; filter semantics, URL params and desktop controls preserved. Inventory groups finishes under one accessible colour swatch, with separate saves/conflict handling; html/body use the staff canvas through the scroll extent.
- New sale removes the redundant question heading. StaffText binds separators to the preceding word in handoff, search/sales, agenda, order/sale summaries, markets, painting days and painting metadata; Agenda status arrows stay attached.
- `staff-mobile.spec.ts` adds navigation geometry at 320–440px, fully visible initial results at 360×640, disclosure/count/URL assertions, grouped-stock saves/background and rendered separator-line checks. Sales/staff-review selectors follow the disclosure and inventory grouping. Fresh screenshots change on staff routes; public snapshot files were not edited.
- Local validation and the complete handoff are in `tasks/audit-results/staff-phone-polish-2026-11-06.md`. Browser/Safari and all new Playwright assertions remain for Claude.

## Public form vertical rhythm (2026-11-07)

- Implemented locally, **partial until Claude runs the affected E2E and reviews fresh screenshots**. Owner reports the incoming E2E baseline is green; no new browser result is claimed. No commit; earlier changes retained.
- Public `/buy` and `/form` use existing tokens: label/control 8px (`space-2`), field/action gap 24px (`space-5`), section gap 32px (`space-6`), heading/body and card-list gap 16px (`space-4`). The divider is centred inside the 32px gap, superseding the old additive 57px rule in the design system.
- Contact fields have no trailing margins; row parents own gaps and retain desktop pairs plus aligned postcode/city. `/buy` removes the duplicate Kontakt heading; QR retains its useful contact heading. The photo substep hides its empty choice wrapper; tabs/add wrap without extra toolbar padding; optional notes have no trailing inline baseline space.
- Shared `ReviewProduct` places artwork, finish/reference photos and price in one top-aligned row in both reviews. Delivery groups and review/terms use parent gaps. Card-bottom padding cancellation and sticky action behaviour, payment wrapping, contrast and footer are preserved.
- HTTP build, lint (existing warnings) and 50 Node tests pass. Playwright discovers 166 cases in layout/design-system/form; browser execution remains for Claude. New layout assertion measures the final details gap at 390×844 as 24 ±2px. Regenerate/review all 12 design/delivery/details/review × mobile/tablet/desktop snapshots without changing tolerance. Files and commands: `tasks/audit-results/public-form-rhythm-2026-11-07.md`.
