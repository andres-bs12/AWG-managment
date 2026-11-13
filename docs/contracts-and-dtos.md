# Decisiones de Diseño: DTOs y Contratos de API (Spring Boot)

> **Actualizado 2026-11-04.** Los DTOs viven ahora en `dto/{auth,market,agenda,order,form,tracking,shop,common}` y tienen **la misma forma que `frontend/src/domain/types.ts`** (el contrato del front es la especificación). Los enums se serializan en minúsculas (`custom`/`finished`, `market`/`vienna`, `unpaid`/`deposit`/`paid`…). Cambios respecto a lo descrito abajo:
> - `OrderRequest`/`OrderItemRequest` → `CreateSaleRequest`/`CreateSaleItemRequest`. **El precio ya no viene del cliente**: lo calcula `PricingService` (49,99 / 39,99 / +12,99). La entrega llega como `marketDayId` + `pickupHour` y la pintura como `paintDate` + `paintStart/paintEnd` (horas decimales); el servicio los convierte a `handoffDate`/`pickUpTime`/`LocalDateTime`.
> - `soldOnDay` se asigna solo: la jornada del puesto de hoy, si la hay.
> - `OrderResponse` → `OrderDto`; `OrderBundleResponse` → `OrderBundleDto` (`order, customer, items, blocks`); `TimeBlockResponse` → `TimeBlockDto` derivado del ítem.
> - `CustomerFormRequest` sigue siendo el «candado»: datos de contacto obligatorios y al menos una foto por adorno custom (validado en `FormService`). Se puede reenviar hasta que empiece la pintura.
> - `TrackingResponse` → `TrackViewDto`. La dirección no se devuelve ni se cambia sin el `formToken` (cabecera `X-Form-Token`), porque el código corto es adivinable.
> - Mappers MapStruct sustituidos por `ViewMapper` (a mano), porque varios campos se resuelven contra el calendario.
> - `CustomColor` añade `GREY` (el front vende rojo/gris); `ItemState`/`OrderState` se eliminaron por no usarse.


Este documento registra las decisiones arquitectónicas y de negocio de los DTOs en `awg-tracking/src/main/java/com/artwithgab/awg_tracking/dto/`. Consúltalo antes de modificar campos de entrada o salida para entender **por qué** están diseñados así.

---

## 1. Módulo Order (`dto/Order`)

### 1.1 `OrderRequest` (Venta en el puesto / iPad del Staff)
- **`customerName`, `phone`, `email` son `@Nullable`:**
  - *Razón operativa:* En el puesto navideño de Viena, para compras rápidas de mostrador (`GENERIC`) en efectivo, muchos clientes no dan teléfono ni email. Además, para encargos `CUSTOM`, el staff genera el pedido rápido y el cliente es quien teclea sus datos de contacto en su propio móvil tras escanear el QR.
- **`marketId` es `@NotNull`:**
  - *Razón de negocio:* `marketId` representa el **puesto físico donde se realiza la venta** (para estadísticas de facturación por mercado), NO el método de entrega (para eso está `deliveryKind`). Toda venta ocurre en un puesto real de la temporada.
- **`orderItemRequestsList` es `@NotEmpty` y `@Valid`:**
  - Un pedido siempre debe contener al menos un adorno. `@Valid` propaga la validación a cada ítem individual.

### 1.2 `OrderItemRequest` (Adorno individual al crear la venta)
- **`petName` y `photos` son `@Nullable`:**
  - Para ítems `GENERIC` estos campos no aplican.
  - Para ítems `CUSTOM`, `petName` y `photos` se capturan en la siguiente fase (Customer Form vía QR).
- **Horarios (ver la tabla de `order_item` en `docs/README.md`):**
  - `handoffDate` (`LocalDate`) es `@NotNull`: todo adorno tiene fecha de entrega.
  - `pickUpTime` (`LocalTime`), `paintStart` y `paintEnd` (`LocalDateTime`) van **sin anotación**. Son obligatorios según `deliveryKind` (MARKET pide hora) e `itemKind` (CUSTOM pide pintura), y esa regla condicional se valida en `OrderService.createOrder`, que responde 400 si falta algo.
  - `soldOnDayId` es la jornada del puesto donde se vendió, no la de recogida.
- **`withName`:** Booleano que indica si el cliente pagó el suplemento de personalización de texto.
- **`customColor`:** Color del lienzo/adorno (`RED`, `GREEN`, `WHITE`).

### 1.3 `OrderResponse` y `OrderItemResponse` (Respuestas completas)
- **Desacoplamiento total de entidades:** No contienen referencias a entidades JPA (`OrderItem` o `Inventory`) para evitar referencias circulares en Jackson (`StackOverflowError`) y fugas de datos de persistencia.
- **Reutilización:** `OrderResponse` es un recurso completo; cada pantalla (QR, Agenda, Ficha de pedido) consume únicamente los campos que necesita sin requerir DTOs redundantes por cada vista.

---

## 2. Módulo Customer Form (`dto/CustomerForm`)

### 2.1 El ciclo en dos fases de los datos del cliente
1. **Fase 1 (Caja / iPad):** Se crea la orden con `OrderRequest` (genera `code` y `formToken`).
2. **Fase 2 (Móvil del cliente):** El cliente escanea el QR (`/form/{formToken}`) y envía `CustomerFormRequest`.

### 2.2 `CustomerFormRequest` (Candado de integridad)
- **`name`, `phone`, `email`, `petName` son `@NotBlank` y `photos` es `@NotEmpty`:**
  - *Razón de negocio:* Este formulario es la red de seguridad del negocio. Ningún encargo custom de pintura entra al taller sin fotos de referencia ni teléfono de contacto.
- **`nameInOrnament` es `@Nullable`:**
  - Contiene el texto exacto que Gab pintará en la bola (solo si contrataron `withName = true`).

### 2.3 `CustomerFormResponse` (Apertura del formulario)
- **Sin pre-rellenado de cliente:** En la operativa del puesto, el cliente siempre escribe sus datos desde cero en su móvil; no se pre-rellena para evitar confusiones.
- **`code` incluido:** Para que la cabecera del móvil confirme al cliente el código de su compra (ej. *«Pedido AWG1042»*). Formato estándar: prefijo `AWG` seguido de 4 dígitos numéricos (rango 1000 - 9999).
- **Sin color global:** El color pertenece a cada adorno dentro de `orderItemResponses`, no a la cabecera.

---

## 3. Seguridad y Tokens: `code` vs `trackToken`

- **`trackToken` eliminado por redundancia:**
  - La pantalla pública de seguimiento (`/track/:code`) solo muestra datos inocuos (primer nombre, nombre de la mascota, estado en taller y horario de recogida). No expone teléfonos, emails ni direcciones completas.
  - Por tanto, la búsqueda pública y los enlaces de email usan directamente el `code` (`AWG` + 4 dígitos, ej. `AWG1042`), simplificando el modelo.
- **`formToken` se mantiene estrictamente:**
  - El formulario tiene permisos de **escritura** (subir fotos, modificar datos del encargo). Por seguridad, requiere un token largo e indescifrable (`formToken`) para impedir que usuarios maliciosos manipulen pedidos ajenos.

---

## 4. Separación de Stock en `Inventory`

- **Modelo de inventario diferenciado:**
  - **`CUSTOM` (Esferas crudas de taller):** Se rastrean estrictamente por la pareja `itemKind = CUSTOM` + `customColor` (`RED`, `GREEN`, `WHITE`). Representan el lienzo virgen que Gab pintará en el taller.
  - **`GENERIC` (Esferas terminadas de expositor):** Representan un inventario global de producto terminado para venta rápida en el puesto. No se rastrean por color en el almacén; se descuentan directamente como una unidad genérica global (`findByItemKind(ItemKind.GENERIC)`).
- **Trazabilidad en `OrderItem` (`inventory_id`):**
  - Cada vez que se crea un adorno, se asocia directamente a la fila de inventario de donde salió (`item.setInventory(inventory)`). Esto deja constancia histórica en base de datos del stock consumido.

---

## 5. Hoja de Ruta: Devoluciones y Reposición de Stock (`Returns & Restock`)

- **Reposición automática vía Trazabilidad:**
  - En una fase futura, cuando se implemente la cancelación de pedidos o reembolso/devolución de un adorno (`cancelOrder` / `refundOrderItem`), el sistema aprovechará la relación `item.getInventory()`.
  - Para reponer el stock al almacén, no será necesario recalcular o adivinar qué tipo o color era el adorno: simplemente se accederá al inventario vinculado y se incrementará la cantidad (`item.getInventory().setQuantity(quantity + 1)`), manteniendo la integridad total del stock sin riesgo de desfasar colores o tipos.


## 6. Invoice documents and fixed Vienna delivery window (Task A, 2026-11-08)

- Payment and handover events retain the existing `OrderNotification` flow. A synchronous listener archives an invoice in the originating transaction; `NotificationService` sends it asynchronously only after commit. Rollbacks archive/send nothing. Initial unpaid sales do not issue an invoice; `deposit`/`paid`, Stripe confirmation and handover do. A handover never fabricates payment: an outstanding deposit remains due until staff records `paid`.
- Each issued document, including an update, receives a **new consecutive number** from the single `invoice_counter` row locked for writing. The counter rolls back with the document, avoiding numbers consumed by failed transactions. `invoice.number` is unique across all seasons. Replacement documents explicitly reference the preceding invoice number and the order code; their totals are replacement balances, not additional purchases. This avoids mutating an issued invoice or reusing its identity. The implementation follows the unique consecutive numbering requirement described by [USP](https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/rechnung.html); fiscal suitability still requires the seller's adviser.
- The stored state key is payment state + total + actual amount received + handover flag. Repeated callbacks/updates with the same state do not create another document. A partial payment uses `Order.amountPaid`, with balance `max(total - amountPaid, 0)`; full payment gives zero. A later handover creates a separate updated document. Documents reference the prior number for the order.
- The archived subject/body are immutable. Only recipient completion (when initially blank) and `sentAt` change. There is no FK to an operational order: cancellation must not delete accounting history. Failed/missing SMTP leaves the same document pending; retries and repeated events serialize on the document row and skip an already sent document. A QR submission fills missing recipients on pending documents. SMTP crash recovery is at-least-once, as described in `deploy.md`.
- Invoice content has one ornament line plus a separate name surcharge when charged, colour/finish, delivery fee, total/paid/balance, payment/handover status, issue date, per-item handoff date/time, seller configuration and Track link. Market pickup uses the known market and `pickUpTime`; finished on-the-spot sales without a pickup time explicitly say the time was not recorded (handover time is shown on a later handed-over invoice). Vienna uses the configured window. No customer/order locale exists today, so issued invoices default to German; the renderer also supports `en` without adding a new public request field.
- Seller identity, UID, tax note and optional IBAN come only from `awg.invoice.*`; defaults are marked placeholders. Tax exemption/VAT treatment is not inferred. Text/plain + escaped text/html MIME alternatives use the existing mail dependency; no PDF or extra dependency. These are implementation choices, not a declaration of tax compliance.
- Additive public API fields: `GET /api/shop/config` returns `deliveryWindowStart` / `deliveryWindowEnd` as `HH:mm`. Track and form `handoffs` retain `kind: "vienna"`, `date`, `marketName`, `untilHour` and gain `toHour`; delivery `fromHour`/`toHour` are decimal Vienna wall-clock hours, normally 18/20. `untilHour` retains its market-closing meaning and is null for Vienna. No request shape changes. HTTP services already pass these DTOs through unchanged; mock and TypeScript types mirror the new fields.
