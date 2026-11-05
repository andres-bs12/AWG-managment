# Contexto del proyecto — ArtWithGab (AWG)

**Actualizado:** 2026-11-05 (sprint 6)  
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

Scripts disponibles en `frontend/package.json`: `dev`, `build`, `lint` y `preview`.

## Escena pública (estilo Santa Tracker)

- Paleta de día de Santa Tracker: tokens `--sky-*`, `--ridge-*` y `--haze` en `styles/tokens.css`. Texto blanco con sombra azul, y casillas del contador azul marino casi opaco para que se lean sobre cualquier fondo.
- Estructura del Home en franjas: cielo con título y contador → puesto sobre la calle (`VillageStreet`) → nieve despejada con los dos botones → pie. Todo comparte una única línea de suelo.
- `HomePage.module.css` define `--stall-w` en `.hero`. De él salen la altura de la calle (13 %) y el tamaño de casas, árboles y personajes, así que las proporciones se mantienen en cualquier pantalla. Las reservas verticales (`100svh - 268/380/440px`) evitan el scroll; se comprobó de 360×640 a 1920×1080.
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
- Arranque: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (datos demo y usuarios demo: `gaby@artwithgab.com`/`gaby`, `andres@artwithgab.com`/`andres`). Tests: `./mvnw test` (92 tests; verificados el 2026-11-05 con Byte Buddy como `-javaagent` en el sandbox).
- Esquema con Flyway (`db/migration/V1..V4`), `ddl-auto=validate`; los tests usan H2 sin Flyway. Un cambio de entidad necesita una migración nueva.
- Errores `{status, message, code, field}` con códigos estables (`docs/sprint5-contract.md`); el front los traduce con `frontend/src/lib/apiError.ts`.
- Ventas del staff idempotentes (`Idempotency-Key`). Pago Stripe con importe distinto → `checkoutStatus=REVIEW` (no se libera; el staff lo resuelve al anotar el pago). Cancelar/abandonar cierra la sesión de Stripe (`expireOrReconcile`).
- Stock editable con `expectedQuantity` (409 `STOCK_CHANGED`), días de pintura (`PaintingDay`, máximo 2 por defecto), fin de temporada `awg.shop.season-end` (24-dic), lista de espera.
- Colores `red`/`green`/`beige` (gris y blanco solo para datos antiguos, `CustomColor.isOffered`) con acabado `shiny`/`matte` (`CustomFinish`); stock por color + acabado.
- Entregas web desde `awg.shop.deliveries-from` (30-nov-2026). El enlace del formulario caduca 30 días tras la entrega (`Order.handedOverAt`, `FormLinkPolicy`, 404 `FORM_EXPIRED`). Track oculta nombres para códigos antiguos cortos sin token.
- `RetentionService` (cada noche): borra fotos y datos personales 60 días tras la entrega (365 si nunca se entregó) y la lista de espera sin confirmar a los 7 días. Lista de espera con doble opt-in (`/waitlist/confirm#token`, `/waitlist/unsubscribe#token`).
- E-mails al dueño y al cliente por evento de pedido (`NotificationService`, tras commit, asíncrono); sin `MAIL_HOST` no se envía nada.
- Contraseñas iniciales del staff: mínimo 10 caracteres fuera de dev. Fotos JPEG/PNG se decodifican antes de guardarse.
- Despliegue: `docker-compose.yml` + `docs/deploy.md`; nginx con cabeceras de seguridad y sin registrar enlaces `/form/`.
- Las auditorías usan Codex CLI (`codex exec -s read-only`) como revisor independiente además de subagentes.

## Tienda pública

- `/buy` ofrece solo adornos personalizados en tres pantallas (diseño con subpasos móviles, entrega y revisión); obtiene colores y disponibilidad de la API, comprueba fechas de entrega y conserva los campos de texto en `sessionStorage`. Las fotos deben volver a añadirse después de recargar.
- El contrato `ShopConfig.colors` requiere que el backend entregue la lista de colores con `inStock`; el mock inicia cada combinación de color y acabado con cantidad 3 (revisión 12). Las pruebas de agotados preparan su propio stock mediante la API. La entrega y el pago definitivo requieren validar la integración real con Stripe.

## Estado y siguientes tareas

Rama `feat/backend-domain` (PR #2 a `main`), subida a GitHub. Sprint 6 (respuestas del dueño + rediseño UX de `/buy`, `docs/sprint6-buy-ux.md`; investigación en `tasks/ux-research/`). Guía para el dueño: `docs/siguiente-fase.md`. Sprints 1–5 terminados, incluida la auditoría final doble (`tasks/audit-final.md`, resultados en `tasks/audit-results/`). Backlog en `tasks/todo.md`; decisiones abiertas del dueño en `tasks/preguntas-pendientes.md` (Stripe, SMTP, despliegue, datos legales, colores, caducidad de enlaces, retención, lista de espera).

Forma de trabajo acordada: Codex CLI (`gpt-6.1-terra`, esfuerzo high para implementar, medium/high para auditar; siempre `< /dev/null`) para frontend y revisiones; Claude para backend delicado, integración y pruebas en navegador. Nunca audita el mismo LLM que escribió el código.

### Sprint 6 — estado del frontend

- 2026-11-05 · Fix e-4 **preparación terminada; comparación de navegador pendiente**: Claude informó 378 aprobados, 3 fallidos y 2 omitidos de 383. Las tres trazas actuales contienen solo los nueve errores de referencia ausente; no hay fallo de foco de fotos en este resultado. Se revisaron las nueve imágenes ya regeneradas y se comprobó igualdad byte a byte con sus `*-actual.png`. Se conservan: no son PNG obsoletos y borrarlos repetiría la inicialización. Sin cambios de app/tests/tolerancias/axe. Build, lint (advertencias existentes) y 23 pruebas Node pasan. Sin Playwright ni commits. Claude debe repetir normalmente `npx playwright test` con las referencias presentes, sin borrarlas ni `--update-snapshots`; revisar además el contenido desplazable que no cubren los PNG. Este es el seguimiento vigente en `docs/ux-validation.md`; los siguientes son históricos.

- 2026-11-05 · Fix e-3 **implementación terminada; validación de navegador pendiente**: Claude informó 377 aprobados, 4 fallidos y 2 omitidos de 383. Las cuatro trazas confirman nueve referencias ausentes y pérdida de foco al completar seis fotos en escritorio. `PhotoTiles` restaura ahora el foco tras el commit de React con `useLayoutEffect` y refs locales (añadir o contador), también al eliminar. El caso E2E conserva las aserciones anteriores y añade conservación de la foto válida y el ciclo quitar/reponer la sexta foto; axe intacto. Se retiraron los nueve PNG por instrucción del dueño; Claude debe regenerarlos, revisarlos y conservar los candidatos aprobados antes de repetir la comparación normal. Build, lint (advertencias existentes) y 23 pruebas Node pasan. No se ejecutó Playwright ni se hicieron commits. Seguimiento actual en `docs/ux-validation.md`; los resultados anteriores que siguen son históricos.

- 2026-11-05 · Fix e-2 **parcial, pendiente de navegador**: las trazas de 25 fallos identificaron un selector ambiguo de staff, un `aria-label` inválido en la muestra de color, un bloqueo de la prueba al aceptar el diálogo nativo y una carrera al cerrar sesión y abrir el formulario. Se corrigieron; la entrega del iPad limpia la sesión y usa navegación completa con reemplazo. Se eliminaron las nueve referencias visuales por instrucción del dueño. Build, lint (advertencias existentes) y 23 pruebas Node pasan. Claude debe regenerar y revisar las nueve capturas y repetir los 383 casos, sin debilitar axe; pueden aparecer fallos antes ocultos por el selector. No se ejecutó Playwright ni se hicieron commits.

- 2026-11-05 · Fix e-1 **parcial, pendiente de navegador**: las 102 trazas de staff muestran página en blanco; el interceptor `**/api/**` capturaba también módulos Vite `/src/api/` y respondía 501. Se limita a rutas que empiezan por `/api/`. Se eliminaron las nueve referencias visuales por instrucción del dueño; Claude debe regenerarlas y revisarlas y repetir toda la suite, incluidos los 102 casos staff, sin debilitar axe. No se ejecutó Playwright ni se hicieron commits.

- 2026-11-05 · Task 11: implementación de los tres P0 y P1 de frontend solicitados, capa visual de staff y suite de regresión terminadas; **validación de navegador y revisión independiente pendientes**. Hora de Viena real en HTTP; recarga por mutación/foco/minuto; clave nueva por borrador y consumo de parámetros; sesión recuperable, entrega segura del iPad con cierre de sesión, búsqueda/atención, reservas retenidas, stock/precios de API, correcciones de pago, cobro/entrega advertidos, finalización compartida y borrado confirmado de mercados/días. Mock sincronizado y semilla 12 con stock 3 preservada. DTOs amplían `finishedPrice`, `checkoutStatus/source`, reservas y saldo de entregas; sin migración de BD. Build/lint y 23 pruebas Node pasan; Maven 92/92. `e2e/staff-review.spec.ts`: 34 casos escritos, 102 ejecuciones previstas en desktop/iPad portrait/landscape, incluida cobertura a 390px y axe; no ejecutados. Stylelint no se pudo instalar por DNS; su configuración existe y el lint local de tokens pasa en 26 módulos. P1-14/17/18/22 siguen para el dueño; P2-21 solo muestra metadatos disponibles y P2-24 queda pendiente. No se hicieron commits. Handoff y matriz por ID: `docs/task11-staff-handoff.md`; reglas en la nueva sección Staff de `docs/design-system.md`.

- 2026-11-05 · Fix b-2 **incompleto**: Claude informó 190/193. Las trazas de tablet y escritorio registran referencias ausentes; la móvil también registra un error axe `target-size`: la barra fija tapa parcialmente los radios del calendario. Se retiraron los siete PNG presentes (dos ya faltaban) por instrucción del dueño; regenerar y revisar las nueve referencias. El solapamiento móvil sigue sin corregir y debe resolverse sin relajar axe ni eliminar la barra fija. No se ejecutó Playwright ni se hicieron commits. Ver `docs/ux-validation.md`.

- 2026-11-05 · Fix b-1 **parcial, pendiente de navegador**: Claude informó 189/193 aciertos; tres fallos visuales y un foco de código postal. Al pulsar «Weiter», el error al perder foco podía mover el botón antes del clic; el botón conserva el foco anterior durante la pulsación de ratón y la validación de envío enfoca el primer error. Se reforzó el caso E2E con el resumen de errores. Por instrucción del dueño se eliminaron las nueve referencias visuales para regenerarlas y revisarlas. Build, lint (advertencias existentes) y 15 pruebas Node pasan; Claude debe ejecutar los 193 casos, revisar las nuevas capturas y comprobar ratón, teclado y táctil. Sin Playwright ni commits aquí.

- 2026-11-05 · Task 8: implementación del formulario QR terminada; validación de navegador pendiente. `/form/:token` usa dos pantallas y comparte shell/cabecera, progreso, fotos, contacto/dirección, notas, inset y barra de acciones con `/buy`; revisión, ayuda, vista ilustrada y timeline también compartidos. Mantiene el contrato, datos fijos del puesto, tokens/caducidad y mock sin cambios. Añadidos resumen de errores/foco, recarga segura por token con aviso para reañadir fotos, estados caducado/inválido/bloqueado/reintento y éxito «Angaben gespeichert». Casos DE/EN en `e2e/form.spec.ts` (11, cuatro proyectos; 44 ejecuciones previstas) y tres pruebas Node de borrador. Build, lint (advertencias existentes) y 15 pruebas Node pasan. El chequeo TS E2E solo informa del conflicto previo Playwright/axe en `helpers.ts:45`. No se ejecutó Playwright ni se hicieron commits. Claude debe revisar la suite completa y capturas; el resultado anterior de 149 casos ya no describe esta versión. Conservar las nueve referencias existentes; no borrarlas ni aceptarlas automáticamente. Handoff: `docs/task8-form-handoff.md`.

- 2026-11-05 · Fix a-3: preparación de referencias terminada; comparación en navegador pendiente. Claude informó 146/149 aciertos; las tres trazas locales confirman únicamente nueve errores de referencia ausente. Se inspeccionaron las nueve imágenes y se verificó que cada PNG de `a11y-visual.spec.ts-snapshots` coincide byte a byte con su `*-actual.png`. Son las referencias recién regeneradas, no las antiguas: se conservan para evitar repetir el ciclo de borrado. Sin cambios de app, selectores, tolerancias ni checks axe. Build, lint (advertencias existentes) y 12 pruebas Node pasan. No se ejecutó Playwright ni se hicieron commits. Claude debe repetir normalmente los 149 casos, sin borrar ni actualizar automáticamente las referencias; detalles y límites de las capturas en `docs/ux-validation.md`.

- 2026-11-05 · Fix a-2 **parcial, pendiente de validar en navegador**: Claude informó 143 aciertos y 6 fallos; tres corresponden a la coma de la fecha inglesa y tres a capturas visuales. Se corrigió la expectativa y se eliminaron las nueve referencias visuales obsoletas para regenerarlas y revisarlas. Se mantienen las comprobaciones axe. Claude debe repetir la suite y revisar las capturas; no se ejecutó Playwright por instrucción del dueño.

- 2026-11-05 · Fix a-1 **parcial, pendiente de validar en navegador**: expectativas E2E actualizadas para nombres y pestañas, acciones de edición, fechas inglesas, columnas responsive y stock agotado preparado por API; se eliminaron las capturas antiguas para regenerarlas y revisarlas. Playwright no se ejecutó por instrucción del dueño; Claude debe ejecutar los 149 casos y revisar las nuevas capturas.

- 2026-11-05 · Task 7B: implementación y revisión independiente del núcleo de Claude terminadas; validación de navegador pendiente. Revisión alineada con acciones precisas y miniaturas estáticas, fecha elegida persistente, `HelpTip` compartido, agotados legibles y enlace a la lista existente de próxima temporada. Guía aislada `/dev/design` solo en DEV; pruebas actualizadas y geometría exacta añadida. Se corrigieron activación manual de tabs, estado Front/Back por ítem, referencias de paneles, foco de radios y transición de `fill`; se conservan las medidas aprobadas. Handoff y verificación en `docs/task7b-handoff.md`. No se ejecutó Playwright ni se hicieron commits.

- 2026-11-05 · Fix 12 **parcial, pendiente de validar**: Claude informó 121 aciertos y un fallo de axe en escritorio. La traza identifica la ayuda de fotos y el contador; el fundido de entrada de `optionsPane` reduce temporalmente su contraste a 2,86:1. La entrada conserva ahora solo el deslizamiento, con texto totalmente opaco y movimiento reducido sin animación. No se modificaron tests ni aserciones. Build y lint pasan (advertencias existentes). No se ejecutó Playwright por instrucción del dueño; Claude debe repetir la suite y revisar capturas antes de cerrar el fix.

- 2026-11-05 · Fix 11 **parcial, pendiente de validar**: Claude informó 120 aciertos y 2 fallos. La traza móvil muestra `Impressum` parcialmente fuera de vista (ratio 0,997869); el ajuste de foco ahora cubre cabecera y pie del contenedor público, con margen de 8 px. La prueba comprueba explícitamente todos los enlaces del pie en ambos sentidos sin relajar las aserciones. La traza de escritorio completa el recorrido tras superar los 30 s; solo ese caso pasa a 90 s (`test.slow`), conservando los límites de cada aserción. Build y lint pasan (advertencias existentes). No se ejecutó Playwright por instrucción del dueño; Claude debe repetir la suite y revisar capturas antes de cerrar el fix.

- 2026-11-05 · Fix 10 **parcial, pendiente de validar**: Claude informó 114 aciertos y 8 fallos. Las trazas muestran controles enfocados recortados o tapados; el ajuste de foco desplazaba `window`, pero el contenedor público tiene su propio scroll. Ahora desplaza el ancestro desplazable y calcula los límites con su rectángulo. Build y lint pasan (advertencias existentes); no se ejecutó Playwright por instrucción del dueño. Claude debe repetir la suite y revisar los ocho casos y las capturas.

- 2026-11-05 · Fix 9 **parcial, pendiente de validar**: la ejecución externa informó 107 aciertos y 15 fallos de teclado/disponibilidad. El foco de errores espera a que se monte el control de destino; el foco de controles desplazables tiene en cuenta la vista previa y las acciones fijas. Build y lint pasan (advertencias existentes). No se ejecutó Playwright por instrucción del dueño; Claude debe repetir la suite y revisar los fallos y capturas. El resultado aportado solo incluye el detalle de dos causas, por lo que no se garantiza que resuelva los 15 fallos.

- 2026-11-05 · Task 5C: `e2e/journey-deep.spec.ts` completo por escrito (siete casos: checkout multipart exacto DE/EN, dos adornos y retirada, nombre/giro/precio, latencia, historial y recarga). Se añadió historial del router a las tres pantallas: Atrás/Adelante conserva el formulario montado y sus fotos; recargar mantiene el regreso a diseño para reañadir fotos. Configuración ampliada para ejecutar este spec también con movimiento reducido; los siete casos se incluyen en los cuatro proyectos sin omisiones. La latencia parte del clic del documento y excluye la demora del driver o de emulación táctil. Cinco muestras de color (precio estable) y cinco de nombre (cambio real de precio), mediana < 100 ms y JSON de resultados. Usa helpers, API mock para stock y HTTP real interceptado para fechas/checkout; sin modificar otros specs ni añadir dependencias. Build y lint pasan (advertencias existentes). **Sin ejecutar Playwright por instrucción del dueño**; Claude debe validar los cuatro proyectos. TypeScript adicional solo informa del conflicto previo Playwright/axe en `helpers.ts:45`. Plan, protocolo y backlog actualizados. Implementación escrita; validación de navegador pendiente.

- 2026-11-05 · Task 5B: `e2e/keyboard-availability.spec.ts` completo por escrito (siete casos: recorrido sin ratón de escritorio, foco/controles ocultos, disponibilidad cambiante DE/EN, agotados DE/EN y fallo de red). Cada Tab/Shift+Tab comprueba el indicador de foco, recorte, visibilidad y solapamiento. Se corrigieron la consulta de fechas antes del pago (vuelve al calendario conservando datos), Enter en calendario, área/foco de radios, foco de subpasos móviles y foco durante la lectura de fotos. Usa el adaptador HTTP real interceptado para disponibilidad/checkout y la API mock para preparar stock; sin hooks nuevos ni cambios en otros specs. Build y lint pasan (advertencias existentes). **Sin ejecutar Playwright por instrucción del dueño**; Claude debe validar a 360/768/1280 px. TypeScript adicional solo informa del conflicto previo Playwright/axe en `helpers.ts:45`; sigue sin resolverse. Plan y protocolo actualizados. Implementación escrita; validación de navegador pendiente.

- 2026-11-05 · Task 5A: `e2e/success.spec.ts` completo por escrito (nueve casos: pago confirmado, dos límites de espera, .ics, SEQ HTTP/mock, cancelación y privacidad HTTP/mock). Track se intercepta usando el adaptador HTTP real incluso sobre el mock; las métricas mock son observables en memoria (`window.__awgMetrics`) solo en desarrollo/test/mock. Corregido el fallback de 60 s cuando Track queda pendiente. Build y lint pasan (advertencias existentes). **Sin ejecutar Playwright**, por instrucción del dueño; Claude debe validarlo fuera del sandbox. Comprobación estática E2E bloqueada por tipos `Page` incompatibles ya existentes entre Playwright 1.49.1 y axe/playwright-core 1.64.1 en `helpers.ts:45`; no se cambiaron dependencias ni otros specs. Plan premium actualizado con las decisiones del dueño y más reactividad; protocolo en `docs/ux-validation.md`.

- 2026-11-05 · Ejecución externa de 49 casos: 45 pasaron; tres fallaron por capturas de referencia ausentes y uno por movimiento reducido. La traza de este último no registra la preferencia en el contexto del navegador; la prueba ahora la activa y comprueba explícitamente. **Pendiente de verificar** con una nueva ejecución externa y de revisar las capturas antes de aceptarlas.

- 2026-11-05 · Suite `/buy` **parcial y sin verificar**: reorganizada y ampliada tras el resultado externo de 27 aciertos y 4 fallos. Se quitó la opacidad de fechas no disponibles y el precio evita animación JS con movimiento reducido. Build y lint pasan; Playwright sigue bloqueado por `EPERM` en puerto 5199. Ejecutar fuera, revisar capturas y completar los casos pendientes en `docs/ux-validation.md`.

- 2026-11-05 · Corrección tras ejecución externa (24 aciertos, 7 fallos) **parcial, sin verificar en navegador**: el precio animado expone texto accesible sin `aria-label` prohibido; movimiento reducido desactiva también las transiciones; la prueba de dos adornos usa acabados disponibles del mock y comprueba ambos diseños. Build y lint pasan (advertencias existentes). La suite sigue bloqueada aquí por `EPERM` al abrir 127.0.0.1:5199; repetir los 31 casos fuera del sandbox y revisar cualquier fallo y las capturas antes de darla por terminada.

- 2026-11-05 · Nueva vista previa ilustrada y flujo de tres pantallas en `/buy`: las fotos se quedan en miniaturas de referencia, nunca sobre el adorno. El diseño responsive y el flujo aún necesitan verificación visual y funcional en navegador; las pruebas y mediciones previstas están en `docs/plan-buy-premium.md`.

- Contratos de color/acabado, rediseño de `/buy` (calendario de entrega, fotos en mosaico, revisión por tarjetas, botón "Zahlungspflichtig bestellen"), páginas `/waitlist/confirm` y `/waitlist/unsubscribe`, soporte staff y mock. Verificado en navegador a 375 px y escritorio contra el backend real (2026-11-05). El texto legal de personalizados sigue pendiente del asesor.

- 2026-11-05 · Task 2 de `/buy` **parcial, pendiente de validación visual y Stripe real**: tarjetas de fechas y validación al salir, revisión con vistas ilustradas, confirmación por sondeo de Track, calendario y SEQ. Métricas agregadas con migración V6, POST público limitado y GET de staff; `buy_paid` se registra al confirmar Stripe. El mock simula el pago al redirigir a la página de éxito. `npm run build`, `npm run lint` y 10 pruebas Node pasan; Maven pasa con Byte Buddy como `-javaagent` (el comando normal falla por auto-attach en sandbox). El sandbox impidió abrir el servidor Vite (`EPERM`): falta comprobar móvil/escritorio, teclado, Stripe y la migración en PostgreSQL. La medición usa el lock de agenda para serializar los contadores; revisar contención antes de producción.

- 2026-11-05 · Task 3 `/buy` **parcial/incompleta**: configuración Playwright, pruebas iniciales, fixture y protocolo en `docs/ux-validation.md`. `npx playwright test --list` descubre 31 ejecuciones; el servidor no arranca en sandbox (`EPERM` en 127.0.0.1:5199), por lo que ninguna prueba de navegador ni captura de referencia está validada. Pendientes exactos y ejecución en el documento. `npm run build` y `npm run lint` pasan (lint con advertencias existentes). No se ha validado Stripe ni declarado que el formulario pase la suite.

- 2026-11-05 · Corrección de pruebas **parcial**: una ejecución externa obtuvo 28 fallos y 3 aciertos. Los recorridos ahora pulsan las etiquetas visibles de los radios y verifican su selección; falta volver a ejecutar toda la suite y diagnosticar los fallos restantes, incluido movimiento reducido. El sandbox sigue bloqueando el servidor de pruebas (`EPERM`).

- 2026-11-05 · Nueva corrección **parcial** tras ejecución externa (15 aciertos, 16 fallos): se ampliaron a 44 px los enlaces de marca y legales y los días disponibles, se desactivaron las animaciones con movimiento reducido y el test captura el checkout antes de navegar. Build y lint pasan (advertencias previas); Playwright sigue sin arrancar por `EPERM` en 127.0.0.1:5199. Falta repetir los 31 casos fuera del sandbox, investigar los fallos restantes y revisar las capturas de referencia, que aún no existen en `frontend/e2e/`.
