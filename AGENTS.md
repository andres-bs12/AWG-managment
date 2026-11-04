# Contexto del proyecto — ArtWithGab (AWG)

**Actualizado:** 2026-10-21  
**Propósito de este archivo:** memoria persistente para el dueño del proyecto y los agentes que trabajen en este repositorio.

## Instrucción de mantenimiento

Lee este archivo al comenzar una tarea. Después de un cambio importante, actualízalo para reflejar el estado real: decisiones nuevas, trabajo terminado, pendientes, problemas conocidos y cambios locales relevantes. Mantén un resumen útil y conciso; no copies la conversación completa ni dejes como vigente información obsoleta. Antes de describir o cambiar el estado del código, revisa `git status` y los diffs actuales.

El árbol de trabajo ya tenía modificaciones sin confirmar cuando se creó esta nota. No las descartes, reviertas ni sobrescribas como parte de otra tarea sin una instrucción explícita.

## Proyecto y fase

ArtWithGab es una herramienta para registrar ventas y coordinar la producción y entrega de ornamentos navideños personalizados en los mercados de Viena de 2026. La aplicación tiene una interfaz pública y herramientas de staff.

- **Frontend:** React, TypeScript y Vite, en `frontend/`. La versión de UX con datos mock se considera cerrada.
- **Backend:** Java 21, Spring Boot 4.1.1 y Maven, en `awg-tracking/`. El dominio está en construcción.
- **Base de datos:** PostgreSQL aparece como objetivo del proyecto, pero la configuración actual de `application.properties` solo declara el nombre de la aplicación; no des por hecho que una base local esté configurada.
- **Fase documentada:** avanzar el dominio/API del backend. El dueño del repositorio escribe en `awg-tracking/`; los agentes no modifican ese módulo salvo petición explícita.

## Reglas de producto y límites

- El formulario del cliente recoge datos y fotos; no cobra. El staff confirma manualmente un pago después de verificar que se recibió.
- Estados de pago acordados en la documentación: `unpaid`, `deposit` y `paid`. `deposit` representa exactamente el 50 % del total porque el estado actual no guarda un importe parcial arbitrario.
- No integrar Stripe, Checkout, PaymentIntent ni otro procesador de pagos mientras se mantenga este flujo.
- El nombre personalizado en el adorno cuesta 12,99 €. Si se quita, no hay reembolso.
- Un pedido puede mezclar adornos `custom` y `finished`. Pintura y recogida/entrega son eventos distintos; comprobar capacidad antes de comprometer un bloque.
- Recogida en mercado: viernes, sábado o domingo. Entrega en Viena: miércoles o viernes. Si un viernes coincide con mercado, tiene prioridad el puesto.
- Capacidad de pintura en casa: lunes, martes y jueves, 3 huecos entre 10:00–13:00; miércoles y viernes, 2 huecos entre 10:00–12:00. Un bloque suele durar 60 minutos, unos 75 si incluye nombre.
- El idioma del staff es inglés; la experiencia pública es alemán/inglés.
- La UI accede a datos solo mediante `frontend/src/api/`. El mock es la fuente predeterminada (`VITE_DATA_SOURCE=mock`); la implementación HTTP sigue siendo stub.
- Buy web, emails, dashboard y pagos reales no forman parte de la fase actual. No inventes IDs (`fileKey`/`nodeId`) de Figma ni confirmes que se envió una notificación si no existe integración real.
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
- `frontend/src/api/http/services.ts`: stubs; cada método falla con un mensaje que explica que HTTP no está conectado.
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

## Backend actual y puntos de integración

El paquete Java usa `com.artwithgab.awg_tracking` (con guion bajo; no cambiarlo al nombre con guion). Hay entidades/DTOs/enums, mappers, repositorios, `InventoryService`, generador de códigos y `OrderService`, pero todavía no hay controllers ni endpoints HTTP implementados. La configuración de persistencia/API también está pendiente.

Antes de conectar el frontend, coordinar estos contratos; la UI mock y el backend aún no coinciden del todo:

- `docs/README.md` y `frontend/src/domain/types.ts` usan pagos `unpaid/deposit/paid`, mientras el backend actual asigna `PaymentState.PENDING`. Revisar y alinear nombres antes de integración.
- `createOrder` devuelve `OrderResponse`; `createSale` en `frontend/src/api/contracts.ts` promete `Order`.
- La UI usa `getOrderBundle()` con `{ order, customer, items, blocks }`; no existe aún una entidad `TimeBlock` en el backend. Decidir si se deriva de los datos de `OrderItem` o se persiste antes de implementar la agenda HTTP.
- La UI necesita consulta de pedido por ID, actualización del estado de pago y cambios de estado/entrega. No asumir que tener métodos de servicio equivale a tener endpoints.
- El backend ya descuenta inventario al crear pedidos. En el futuro, cancelaciones/devoluciones deben considerar la relación `OrderItem.inventory` documentada en `docs/contracts-and-dtos.md`.
- Resuelto (2026-11-03): `OrderItem` separa venta (`soldOnDay`), pintura (`paintStart/paintEnd`, `LocalDateTime`, obligatorios en CUSTOM) y entrega (`handoffDate` + `pickUpTime`, hora obligatoria solo en MARKET). No hay entidad `TimeBlock`; los bloques se derivan de la pintura. Reglas en `docs/README.md`. Request/response/mapper y validaciones de `createOrder` siguen pendientes.

## Estado del repositorio al crear esta nota

Rama `feat/backend-domain`, en `5e8cf77` (`feat(backend): implement InventoryService, stock deduction and ResourceNotFoundException`), **6 commits por delante** de `origin/feat/backend-domain`. El directorio ya tenía cambios locales antes de crear este archivo; no son parte de ese commit y deben preservarse.

Cambios locales observados (sin confirmar):

- Backend: `OrderRepository.java` añade `@Transactional(readOnly = true)` a la búsqueda por código. `OrderService.java` añade lectura por código y métodos para cambiar estado de pago, marcar/deshacer entrega y cambiar estado de un ítem. No hay todavía búsqueda por ID/bundle; revisar el diff antes de continuar. El archivo también contiene imports/código sin terminar que pueden requerir limpieza.
- El backlog de `tasks/todo.md` aún marca como pendiente desmarcar `handedOver` si un ítem deja de estar `FINISHED`; el método `setItemStatus` del diff local parece implementar ya ese comportamiento. Verificarlo y sincronizar el TODO antes de repetir el trabajo.
- Frontend: `OrderDetailPage.tsx` y su CSS muestran progreso de adornos y abren un diálogo al terminar el último; se añadieron `CompleteOrderDialog.tsx` y CSS. El texto actual del diálogo afirma que se enviará una notificación de recogida; no hay integración de email en esta fase, así que confirmar o corregir ese copy antes de darlo por válido.
- Documentación: `docs/README.md`, `docs/frontend-api-swap.md` y `tasks/todo.md` reflejan el flujo de pago manual y registran diferencias/pedientes de integración.
- `package-lock.json` en la raíz aparece como archivo sin seguimiento; determinar si es intencional antes de incluirlo o eliminarlo.

`git status` mostró estos archivos modificados/no seguidos:

```text
 M awg-tracking/src/main/java/com/artwithgab/awg_tracking/repository/OrderRepository.java
 M awg-tracking/src/main/java/com/artwithgab/awg_tracking/service/OrderService.java
 M docs/README.md
 M docs/frontend-api-swap.md
 M frontend/src/pages/staff/OrderDetailPage.module.css
 M frontend/src/pages/staff/OrderDetailPage.tsx
 M tasks/todo.md
?? frontend/src/components/staff/CompleteOrderDialog.module.css
?? frontend/src/components/staff/CompleteOrderDialog.tsx
?? package-lock.json
```

## Siguientes tareas conocidas

La lista editable está en `tasks/todo.md`; estos son los principales pendientes anotados allí y en la documentación:

1. Revisar y preservar los diffs locales existentes; no resolverlos suponiendo que pertenecen a la tarea nueva.
2. Completar y alinear el dominio/enums del backend con las decisiones en `docs/README.md`.
3. Implementar búsqueda de pedido por ID y decidir el contrato de bundle/bloques para `OrderDetailPage` y `PaintPage`.
4. Alinear la respuesta de `createOrder` con el contrato frontend.
5. Verificar que el cambio local de `setItemStatus` cubre el caso de desmarcar `handedOver` cuando un ítem deja de estar `FINISHED`; si sí, actualizar el TODO en vez de repetirlo.
6. Exponer la actualización manual de estado de pago y los métodos necesarios para la UI.
7. Implementar persistencia/API y solo conectar HTTP cuando se solicite; seguir `docs/frontend-api-swap.md`, incluida la recarga de Entregas tras mutaciones.

No empieces el swap HTTP, pagos reales ni cambios del backend sin respetar la petición concreta del dueño y las restricciones de fase anteriores.
