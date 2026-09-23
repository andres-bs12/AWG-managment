# Producto ArtWithGab

Gestionar ventas de Navidad (Viena, desde finales de noviembre 2026): pedidos, agenda de pintura, pagos e inventario. ~15 h/semana.

Lee esto **solo** si cambian reglas de negocio o entidades. UX staff → `docs/staff.md`.

## Stack

Java + Spring Boot · React + TypeScript · PostgreSQL. Pagos en puesto: **Register cash** o **Stripe online**. El form del cliente no es la caja.

## Decisiones cerradas

- Canon venta custom staff = FigJam **Buy custom flow** `19:453` ([board](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-453)). No el diagrama auto “Staff sale flow v1”. No los HTML mocks.
- Form = datos; pago = cash o Stripe; estados en ficha: unpaid / deposit (~50%) / paid.
- Name en puesto (+12,99 €, ~6 caracteres); sin refund al quitarlo.
- Track público en v1 (código/enlace, sin cuenta). Buy **web** no operativo (el Buy custom del FigJam es **en puesto**).
- Pintura ≠ pickup. Capacidad se valida **antes** de comprometer.
- Cliente público DE/EN, navideño. Staff **EN**, operativo.
- Un pedido puede mezclar custom + finished, con entregas distintas; cobro en ficha.

## Flujo staff (custom)

Fuente: FigJam `19:453`.

1. Ask for when (hoy / otro día).
2. Capacidad: Time today? / Enough time / Can we deliver / Can we move another sell. Si no cabe y no se puede mover → cancelar.
3. Fill user data (dirección si Vienna; mercado si Market) **antes** del QR.
4. Generate QR & link.
5. Add name (sí/no, ambas vías siguen).
6. Form en device staff o QR cliente.
7. Payment: cash registrado o Stripe.

Finished: sin slot de pintura; entra desde navbar/agenda.

## Capacidad y agenda

- Mercado (recogida): **viernes, sábado y domingo**. No hay pickup entre semana.
- Pintura en casa, acumulable **antes** del handoff:
  - Entrega **miércoles** (Vienna): desde el **lunes**.
  - Entrega **viernes** (Vienna o mercado): desde el **jueves**.
  - **Siguiente mercado** (sáb/dom o fin de semana): desde el **lunes**.
- Huecos de pintura en casa: lun/mar/jue **3** (10:00–13:00); mié/vie **2** (10:00–12:00). Si ese viernes hay mercado, gana el mercado (12:00–19:00); no se suman Casa + puesto.
- Bloques ~60 min, ~75 con nombre, dentro del horario de ese **día** de pintura.
- Agenda: iniciar / pausar / terminar; ajuste manual. Venta desde calendario (bloque custom) o navbar (custom o finished).
- Mover otro pedido para hacer sitio: en el canon; v1 puede ser pregunta + movimiento manual.

## Entrega y Track

- **Market pickup** solo vie/sáb/dom, con hora en el puesto.
- **Vienna** domicilio: **miércoles y viernes**, sin hora concreta.
- Track: preparing / ready / delivered. Pickup: In the workshop → Ready to pick up → Handed over. Vienna: In the workshop → Out for delivery → Handed over. Start no cambia el track; Finished activa el paso medio. Handed over de Vienna se marca en Deliveries del día. Dirección Vienna editable. Email y teléfono obligatorios.

## Entidades (FigJam `19:2599`)

```
customer 1──N order 1──N order_item
market 1──N market_day   ← horario real por día (pintura o puesto)
```

| Tabla | Rol |
|--------|-----|
| `customer` | Comprador: `name`, `email`, `phone` (texto). Sin dirección aquí. |
| `order` | Pedido: `code`, `payment_state` (unpaid/deposit/paid), `total`, `handed_over`, `form_token`, `track_token`. Si **algún** ítem es Vienna → `delivery_address?` en el pedido. |
| `order_item` | Línea custom/finished: producción (`not_started` → `in_progress` → `finished`), `delivery_kind` (market/vienna), día/hora de pickup o handoff, bloque de pintura, datos del form (pet, name on ornament, photos, note). Inventario = más adelante. |
| `market` | Lugar: `kind` market \| home, temporada y `stall` (null en casa), `total_cost`. **No** guarda open/close. |
| `market_day` | Un día concreto: `date`, `open_time`, `close_time`. Recogida en puesto: vie/sáb/dom. |

**Dirección:** no en Customer. Vive en el **pedido** cuando hay que entregar algo a domicilio. Cada ítem solo dice **adónde va** (`market` o `vienna`); el staff ve en la ficha qué líneas son pickup y cuáles delivery.

El mismo market no abre siempre a la misma hora → una fila `market_day` por jornada. Calendario / enough time mira `market_day`. Tipos UI: `frontend/src/domain/types.ts` (la UI aún guarda address por ítem; el esquema canónico es address en Order).

## Límites v1

Internet obligatorio. Sin IA, sin catálogo online. Dashboard, inventario y emails: más adelante. Spec histórico (huecos FigJam, plan de sprints): `docs/archive/`.
