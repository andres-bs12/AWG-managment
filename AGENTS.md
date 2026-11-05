# Contexto del proyecto — ArtWithGab (AWG)

**Actualizado:** 2026-11-05  
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

- El formulario del cliente recoge datos y fotos; no cobra. El staff confirma manualmente un pago después de verificar que se recibió.
- Estados de pago acordados en la documentación: `unpaid`, `deposit` y `paid`. `deposit` representa exactamente el 50 % del total porque el estado actual no guarda un importe parcial arbitrario.
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
- Pedidos web `PENDING` ocupan horas pero se ocultan en Agenda/Entregas hasta que Stripe confirma.
- Arranque: `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev` (datos demo y usuarios demo). Tests: `./mvnw test` (63 tests).
- Esquema con Flyway (`db/migration/V1..V3`), `ddl-auto=validate`; los tests usan H2 sin Flyway. Un cambio de entidad necesita una migración nueva.
- Errores `{status, message, code, field}` con códigos estables (`docs/sprint5-contract.md`); el front los traduce con `frontend/src/lib/apiError.ts`.
- Ventas del staff idempotentes (`Idempotency-Key`). Pago Stripe con importe distinto → `checkoutStatus=REVIEW` (no se libera; el staff lo resuelve al anotar el pago). Cancelar/abandonar cierra la sesión de Stripe (`expireOrReconcile`).
- Stock editable con `expectedQuantity` (409 `STOCK_CHANGED`), días de pintura (`PaintingDay`, máximo 2 por defecto), fin de temporada `awg.shop.season-end` (24-dic), lista de espera.
- E-mails al dueño y al cliente por evento de pedido (`NotificationService`, tras commit, asíncrono); sin `MAIL_HOST` no se envía nada.
- Contraseñas iniciales del staff: mínimo 10 caracteres fuera de dev. Fotos JPEG/PNG se decodifican antes de guardarse.
- Despliegue: `docker-compose.yml` + `docs/deploy.md`; nginx con cabeceras de seguridad y sin registrar enlaces `/form/`.
- Las auditorías usan Codex CLI (`codex exec -s read-only`) como revisor independiente además de subagentes.

## Tienda pública

- `/buy` ofrece solo adornos personalizados en cinco pasos; obtiene colores y disponibilidad de la API, comprueba fechas de entrega y conserva los campos de texto en `sessionStorage`. Las fotos deben volver a añadirse después de recargar.
- El contrato `ShopConfig.colors` requiere que el backend entregue la lista de colores con `inStock`; el mock marca rojo y gris disponibles, verde y blanco agotados. La entrega y el pago definitivo requieren validar la integración real con Stripe.

## Estado y siguientes tareas

Rama `feat/backend-domain` (PR #2 a `main`), subida a GitHub. Sprints 1–5 terminados, incluida la auditoría final doble (`tasks/audit-final.md`, resultados en `tasks/audit-results/`). Backlog en `tasks/todo.md`; decisiones abiertas del dueño en `tasks/preguntas-pendientes.md` (Stripe, SMTP, despliegue, datos legales, colores, caducidad de enlaces, retención, lista de espera).

Forma de trabajo acordada: Codex CLI (`gpt-6.1-terra`, esfuerzo high para implementar, medium/high para auditar; siempre `< /dev/null`) para frontend y revisiones; Claude para backend delicado, integración y pruebas en navegador. Nunca audita el mismo LLM que escribió el código.
