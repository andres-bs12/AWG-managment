# Decisiones de Diseño: DTOs y Contratos de API (Spring Boot)

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
- **`petName`, `photos`, `pickUpHour` son `@Nullable`:**
  - Para ítems `GENERIC` estos campos no aplican.
  - Para ítems `CUSTOM`, `petName` y `photos` se capturan en la siguiente fase (Customer Form vía QR).
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
