# ArtWithGab (AWG)

Ventas de ornamentos de Navidad personalizados (mercados Viena 2026): pedidos, agenda de pintura, pagos. App en `frontend/` (Vite + React + TS). Backend Spring en `awg-tracking/`.

## Fase actual — backend

- **Frontend v1 (mocks): cerrado.** No reabrir reglas de negocio ni rediseñar flujos staff salvo petición.
- **Ahora:** dominio y API en Spring. **Lo hace el dueño del repo.** Los agentes **no** tocan `awg-tracking/` (ni modelos, enums, controllers, POM, etc.) **salvo petición explícita**.
- **No ahora:** Stripe real, emails, Buy web, dashboard, inventario.

Arranque front: `frontend/README.md`. Canon visual staff: FigJam Buy custom [`19:453`](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-453). NodeIds mid-fi: `docs/figma.md`. Swap mocks→HTTP: `docs/frontend-api-swap.md`.

## Stack y límites

Java + Spring Boot · React + TypeScript · PostgreSQL. Pago en puesto: cash o Stripe. Form del cliente ≠ caja. Staff copy **EN**; público DE/EN. UI solo habla con `frontend/src/api/`. No inventes `fileKey` / `nodeId` de Figma. No commits con secretos.

## Decisiones de producto (cerradas)

- Form = datos; pago = cash o Stripe; estados: unpaid / deposit (~50%) / paid.
- Name en puesto (+12,99 €); sin refund al quitarlo. Track público en v1 (código/enlace). Buy **web** no operativo.
- Pintura ≠ pickup. Capacidad **antes** de comprometer. Pedido puede mezclar custom + finished.
- Mercado (recogida): vie/sáb/dom. Vienna domicilio: mié/vie. Bloques pintura ~60 min (~75 con nombre).
- Capacidad casa: lun/mar/jue 3 huecos (10–13); mié/vie 2 (10–12). Si viernes hay mercado, gana el puesto.

## Entidades

```
customer 1──N order 1──N order_item
market 1──N market_day
```

| Tabla | Rol |
|--------|-----|
| `customer` | `name`, `email`, `phone`. Sin dirección. |
| `order` | `code`, `payment_state`, `total`, `handed_over`, tokens form/track. Si algún ítem es Vienna → `delivery_address?` en el pedido. |
| `order_item` | custom/finished; producción; `delivery_kind` (market/vienna); slot pintura; datos del form. |
| `market` | `kind` market \| home; temporada; `stall`; coste. Sin open/close. |
| `market_day` | `date`, `open_time`, `close_time` por jornada. |

Tipos UI de referencia: `frontend/src/domain/types.ts` (la UI mock aún guarda address por ítem; el esquema canónico es address en Order).

## Frontend staff (cerrado)

Rutas: `/staff/agenda`, `/deliveries`, `/markets`, `/sales/new`, `/orders/:id`, paint. Wizard: items → delivery → qr → payment → done (`saleDraft.ts`). Tokens `--staff-*`. Primitivas en `components/ui` con `tone="staff"`. No tocar el orden del wizard ni el contrato `api` salvo petición.

## Qué no cargar

`references/html-mocks/`, `mocks/`, diagramas `docs/flujo-venta.*` — no son canon.
