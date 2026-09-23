# Staff UX — paquete de fase

Fase actual: pulir jerarquía, botones y flujos visuales. La funcionalidad v1 (mocks) ya está. Canon de negocio: FigJam Buy custom `19:453` — detalle en `docs/product.md`.

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/staff/login` | Login (sin layout) |
| `/staff/agenda` | Agenda |
| `/staff/deliveries` | Lista de deliveries (navbar + aside de Agenda) |
| `/staff/markets` | Lista de mercados (sin Casa) |
| `/staff/markets/new` | Alta de mercado |
| `/staff/markets/:id` | Editar mercado y sus días |
| `/staff/sales/new` | Nueva venta (wizard) |
| `/staff/orders/:id` | Ficha pedido / cobro |
| `/staff/orders/:id/paint/:itemId` | Paint (sin header) |
| `/staff` | redirect → agenda |

Cuentas mock: `frontend/README.md`.

## Archivos

| Qué | Dónde |
|-----|--------|
| Layout + guard | `frontend/src/layouts/StaffLayout.tsx` |
| Agenda | `pages/staff/AgendaPage.tsx` + `components/staff/AgendaSessionList.tsx` (lista móvil, calendario para reorganizar) |
| Deliveries | `pages/staff/DeliveriesPage.tsx` + `components/staff/ViennaDeliveryCard.tsx` (vista rápida de reparto) |
| Markets | `pages/staff/MarketsPage.tsx` + `MarketEditorPage.tsx` |
| Wizard venta | `pages/staff/NewSalePage.tsx` + `saleDraft.ts` |
| Pedido | `pages/staff/OrderDetailPage.tsx` + `components/staff/OrderItemCard.tsx` + `OrderPaymentPanel.tsx` — pickup: **Mark picked up**. Vienna: el handoff vive en Deliveries |
| Paint | `pages/staff/PaintPage.tsx` + `components/staff/PaintStudio.tsx` |
| QR | `components/staff/QrCode.tsx` |
| Primitivas | `components/ui/` (`Button`, `ButtonLink`, `ChoiceList`, `Field`, `SegmentedControl`) |

## Wizard (`saleDraft.ts`)

`SalePhase`: **items → delivery → qr → payment → done**. El paso QR incluye la elección de dónde se llena el formulario: “Continue to payment” (el cliente escanea) o “Fill on this iPad instead” (vuelve a pago al regresar). Done no repite el enlace; acción principal “New sale”. Draft en `sessionStorage` (`awg-sale-draft`). `?fresh=1` en New sale arranca vacío.

Orden de negocio (no lo cambies en esta fase): **cuándo → capacidad → datos → QR → name → form → pago**.

- Name = decisión en puesto; sin refund después.
- Form = captura (device staff o QR cliente). Pago = cash o Stripe (mock: `setPaymentState`).
- Custom necesita slot de pintura; finished no.
- Varios custom: una sesión por ornamento, cada una en el primer hueco libre antes de su entrega (pueden caer en días distintos). Con recogida compartida, un solo “Painting plan” lista todas las sesiones; “Different pickup times” separa tarjetas.
- Una hora elegida en la agenda se conserva al cambiar la recogida si sigue siendo anterior a la entrega.

## UI

- Copy **EN**. Tokens `--staff-*`, `--font-staff` en `styles/tokens.css`.
- Navbar: **Agenda**, **Deliveries**, **Markets** y **New sale**. El estado activo es visual (sin texto “Current”). Pedido, paint y el editor de mercado son subpáginas: **←** debajo de la barra, encima del título.
- `tone="staff"` en primitivas. Botones grandes; una acción primaria por paso.
- No añadir look navideño al staff.

## Figma mid-fi (esta fase)

fileKey `CfdWY2JGaBza9uZHro1qqx`. Tabla y MCP: `docs/figma.md`.

- Agenda: `78:848` / `78:849` / Today `78:1162`
- New sale navbar: `78:1357` · Entrega: `78:1415`
- Entrega OK / reubicar / no cabe: `80:772` / `80:802` / `80:832`

Quality set Sprint 1 (`15:681`…) = solo referencia.

## Fuera de alcance

Spring, Stripe real, emails, Buy web, dashboard, inventario. No cambiar el orden del wizard de venta.

## Criterio de interfaz (septiembre 2026)

- Staff se usa en iPad de 11 pulgadas y iPhone; reparto se prioriza en móvil.
- Mantener Navidad ilustrada en público y animación de tracking. Refinar controles y composición; staff usa superficies tranquilas sin escenas decorativas.
- Una acción principal por contexto. Botones secundarios y enlaces con menor peso.
- Agenda: hora, referencia, ornamento y estado. Instrucciones de reorganización bajo disclosure.
- Calendario: tocar un hueco libre propone 1 h; con ratón se arrastra y en táctil se mantiene pulsado y se arrastra (así el scroll sigue funcionando). Una barra de confirmación (“Start sale”) abre la venta con esa hora. “Move sessions” sirve solo para mover sesiones existentes.
- En iPhone, Agenda abre como lista; el calendario queda disponible para consultar o reorganizar. Al abrir un pedido se conserva día, bloque y vista al volver.
- Reparto: dirección, teléfono y artículo visibles sin abrir pedido; acceso desde el día de agenda con `mode=route`.
- La ficha de pedido prioriza estado, entrega/cobro y cada ornamento. Contacto completo, formulario ya terminado y ajustes de producción quedan en secciones desplegables. En una entrega, dirección y teléfono aparecen arriba.
- “Open delivery run” solo abre la vista de reparto; no cambia el estado. “Ready for delivery” significa que el ornamento está terminado, no que ya salió a ruta.
- Abrir Paint consulta la referencia. `Start painting` es explícito y mantiene el bloqueo de reubicación; `Mark finished` sigue siendo primario.
- Formulario y tracking comparten `ProgressSteps`; tracking usa `OrderReceipt`. La revisión del formulario agrupa en tres tarjetas: ornamento y datos del cliente (editables fila a fila) y recogida y pago (solo lectura, fijado en el puesto). Importe y estado de pago se muestran cuando la API los proporciona, sin inferir que enviar el formulario significa pagar.
- Horarios no disponibles permanecen visibles. QR ampliable en diálogo. Confirmaciones identifican el resultado; copiar solo confirma tras éxito.
- Evitar duplicar título, etiqueta y descripción. No ocultar datos necesarios para la acción actual. Filas para comparar, secciones para revisar, tarjetas para agrupar una unidad.

Validación: compilación TypeScript/Vite y lint (avisos existentes de hooks/Fast Refresh). Navegador: agenda en 1194×834; formulario, reparto y QR en 390×844; envío mock y copia del código; recuperación de imagen del borrador tras recargar. El selector nativo de fecha bloqueó la prueba de alta de mercado en el navegador integrado; no se completó esa comprobación de extremo a extremo.
