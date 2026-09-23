# ArtWithGab — contexto del proyecto

> Archivado (spec largo). No cargar en chats de implementación. Vigente: `docs/product.md` (reglas) y `docs/staff.md` (UX staff).

## Objetivo
Gestionar las ventas de Navidad desde la última semana de noviembre de 2026. Andresito dispone de ~15 h/semana (~150 h hasta finales de noviembre) para un proyecto entendible, mantenible y presentable en portafolio.

## Stack confirmado
- Backend: Java + Spring Boot (una app, módulos: pedidos, agenda, pagos, inventario). **Andresito monta y desarrolla el backend.**
- Frontend: React + TypeScript (cliente público + gestión staff).
- Base de datos: PostgreSQL
- Pagos: en puesto — **Register cash** o **Stripe online** (según flujo canónico). El form del cliente no es la caja.
- Pendiente: alojamiento, almacenamiento de fotos, servicio de email (presupuesto provisional ~30–60 €/mes en temporada + dominio + comisiones)

## Fuente de verdad de flujos
- **FigJam canónico (staff custom):** sección **Buy custom flow** en [Christmas-2026-web](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-453) (`fileKey` `9lexMCksAryAx0vio6OC7D`, `nodeId` `19:453`). Editado por Andresito — priorizar sobre mocks HTML y sobre el diagrama auto “Staff sale flow v1”.
- Detalle de IDs Figma: [figma.md](../figma.md).
- Mocks HTML (`references/html-mocks/`): wireframes de funcionamiento; no son el diseño final ni el flujo canónico.

## Mocks HTML actuales (`references/html-mocks/`)
- Propuesta inicial de funcionamiento (agenda, venta, form, track) para cablear backend/UI simple.
- **No son el diseño final.** Look navideño (cuaderno) = capa UX posterior; no cambia reglas de negocio.

## Sitio público (home / main page)
- Repo: https://github.com/andres-bs12/AWG-managment
- **Visión de diseño (final):** casita / mercadito navideño, nieve; montañas tipo countdown Google Christmas. Atmósfera total navideña.
- CTA: **Buy** | **Track** (+ footer Instagram/contacto). Sin tienda/catálogo.
- **Buy (web self-serve):** aún **no** operativo en v1 (placeholder OK). El “Buy custom flow” del FigJam es el flujo **en el puesto (staff)**, no el Buy web.
- **Track:** sí en v1 — código y/o enlace privado (sin cuenta).
- Transición a Track: pantalla D→I con **trineo** mientras carga.
- **Responsive:** mobile-first + desktop. Targets abajo.

## Flujo canónico — Buy custom (staff en puesto)

Fuente: FigJam `19:453`. Resumen operativo:

1. **User comes** → **Ask for when**
2. **TODAY**
   - **Time today?**  
     - Si hay hueco hoy → **Fill user data**  
     - Si no → **Enough time??** (¿aún cabe pintar a tiempo?)  
       - Sí → **Fill user data**  
       - No → **Can we deliver?** (¿podemos comprometer otra entrega?)  
         - Sí → entra al branch **Another day** (`Enough time`)  
         - No → **Can we move another sell?**  
           - Sí → **Fill user data** (liberando hueco)  
           - No → **Cancel sell**
3. **Another day**
   - **Enough time** (capacidad / bloques antes de esa fecha)  
     - Sí → **Vienna or market**  
       - **Vienna** → **Fill data with address** → **Generate QR & link**  
       - **Market** → **Select market** → **Fill data** → **Generate QR & link**  
     - No → **Can we move another sell?**  
       - No → **Cancel**  
       - Sí → (completar en FigJam si falta flecha; intención: liberar hueco y seguir a Vienna/market)
4. Tras datos (rama today): **Generate QR & link**
5. **Add name** (sí/no — se decide en puesto; ambas vías siguen)
6. **Complete form in staff device?**  
   - Yes → **Form on staff device**  
   - No → **Customer opens QR**
7. **Payment**  
   - **Cash** → **Register cash**  
   - **Card** → **Stripe online**

### Reglas que implica este flujo
- Primero **cuándo** (hoy / otro día), luego capacidad, luego datos, luego QR, luego name, luego dónde se llena el form, luego pago.
- **Fill user data** / address / market van **antes** del QR (no solo después en el móvil).
- Name = decisión en puesto (**Add name**), no refund posterior.
- Form = captura (staff device o QR cliente). Pago = cash registrado o Stripe.
- “Move another sell” aparece en el flujo canónico cuando no cabe; si no se puede mover → cancelar venta.

### Huecos menores en el FigJam (revisión)
- Posible flecha **YES** faltante desde **Time today?** hacia **Fill user data** (el camino “sí hay tiempo hoy” debe quedar explícito).
- En branch **Another day**, **Can we move another sell?** hoy solo muestra camino **NO → Cancel**; falta el **YES** explícito hacia Vienna/market.
- Typos en shapes: `moce` → move, `Slect` → Select, `FIll` → Fill (cosmético).

## Venta y pedidos
- Canal staff (principal v1): flujo **Buy custom** arriba + productos finished (sin pintura) desde navbar/agenda según UI.
- Un pedido puede incluir varios ornamentos (custom y/o finished) con fechas/modalidades distintas; cobro en ficha (cash / Stripe / parcial).
- Cliente: form en móvil (o en device staff) — fotos, perrito, contacto.

## Personalización
- Fotos de móvil, varias imágenes, nota opcional.
- Precio base provisional 49,99 € (configurable por mercado).
- Nombre: +12,99 €, límite ~6 caracteres.
- **Add name** en el flujo canónico (antes/junto al form); sin refund por quitar name después.

## Pagos
- Tras el form (staff o QR): decisión **Payment** → **Register cash** o **Stripe online**.
- También se puede marcar estado en ficha (unpaid / deposit ~50% / paid) con UI de botones grandes.
- El formulario del cliente **no** es la caja.

## Capacidad
- En mercados: bloques ~60 min, o ~75 con nombre, dentro del horario.
- Fuera de mercado / otro día: validar **Enough time** antes de comprometer.
- Preguntas del flujo: Time today? / Enough time / Can we deliver / Can we move another sell.
- No sumar capacidades mercado + fuera el mismo día sin regla explícita.

## Agenda
- Controles: iniciar, pausar, terminar; ajuste manual.
- Crear venta:
  1. **Calendario** — arrastrar bloque de pintura (custom).
  2. **Navbar** — custom (sigue lógica Ask for when → capacidad → datos → QR) **o** finished (sin slot).
- Un pedido puede mezclar custom + finished.
- Mover otro pedido para hacer sitio: está en el FigJam canónico; implementación completa puede ser v1 parcial (pregunta + movimiento manual) y automatización fina después.

## Entregas
- **Market** (elegir mercado) o **Vienna** (domicilio + dirección).
- Domicilio: mié/vie sin hora concreta (salvo que el flujo fije otra cosa).
- Pueden entregar lo pintado el mismo día si **Time today?** / capacidad lo permiten.

## Seguimiento (Track — cliente)
- Código y/o enlace privado; sin cuenta.
- Estados: en preparación · listo para recoger / envío · cuándo ir o cuándo llega.
- Dirección editable en Track si es Vienna.
- Animaciones: ornamento / pincel; emails confirmación / listo / cambio entrega.
- Email y teléfono obligatorios.

## Gestión (staff)
- Dos accesos, mismos permisos; sync multi-dispositivo.
- Dashboard cobros, lista entregas, inventario blanks + finished.
- UX staff clara (botones grandes); animación navideña no obligatoria en gestión.

## Diseño y UX

### Separación funcionamiento vs look
1. Flujos FigJam + mocks + backend.
2. UI simple si hace falta un feature.
3. Look navideño después, sin cambiar reglas.

### Cliente público
- Main cabaña + Buy/Track; form mobile-first navideño; Track con trineo.
- Targets: **iPad Air**, **MacBook Air 13"**, **mobile**.

### Idiomas
- Cliente DE/EN; gestión **EN**.

## Límites v1
- Requiere internet; sin IA; sin catálogo online.
- Buy **web** no operativo; Buy custom **en puesto** sí (FigJam).
- Animaciones finales por fases.

## Organización
- Sprints ~15 h/semana en Jira; demo con Gaby.
- Backend: Andresito. Sprint plan: [sprint-plan.md](./sprint-plan.md).

## Decisiones cerradas
- Stack Java/Spring + React/TS + PostgreSQL.
- Canon de venta custom staff = FigJam **Buy custom flow** (`19:453`).
- Form = datos; pago = cash o Stripe (y estados unpaid/deposit/paid en ficha).
- Name en puesto; sin refund.
- Track público en v1; Buy web más adelante.
- Pintura ≠ pickup; capacidad se valida antes de comprometer.

## Entidades backend (v1 — alineado a FigJam Entities)

Fuente visual: FigJam sección **Entities** (`19:2599`) —
[abrir](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-2599).

### Tablas

| Tabla | Rol |
|--------|-----|
| `customer` | Comprador (`phone` como texto) |
| `order` | Pedido + `payment_state` + `total` |
| `order_item` | Línea custom/finished + delivery + cost + photo |
| `market` | El **lugar** (Rathaus, Casa, …) + `total_cost` temporada |
| `market_day` | **Cada día concreto** de ese market con **sus** horas |

### Por qué `market_day` (decisión cerrada)

El **mismo** market **no** abre siempre a la misma hora.  
Ej.: Rathaus el sábado a las 9 y el domingo a la 1 → **dos filas** `market_day`, un solo `market`.

```
market
  id
  name              -- "Rathausplatz" | "Casa"
  kind?             -- market | home
  total_cost        -- coste del puesto / temporada (márgenes)
  -- opcional: start/finish solo como info de temporada, NO como horario

market_day
  id
  market_id
  date              -- 2026-11-28
  open_time         -- 09:00  (puede cambiar al día siguiente)
  close_time        -- 19:00
```

**Ejemplos**

| market | market_day |
|--------|------------|
| Rathausplatz | sáb 28 nov · 09:00–19:00 |
| Rathausplatz | dom 29 nov · 13:00–19:00 |
| Casa | lun 24 nov · 10:00–13:00 (3 h) |
| Casa | mar 25 nov · 10:00–13:00 (3 h) |

- Entre semana sin puesto → días de **Casa**, 3 h cada uno (mié/vie: excepción entrega).
- Calendario / enough time → solo mira `market_day`.
- Si el mismo día hubiera Casa y mercado real → gana el market real (no sumar).

### Relación

```
customer 1──N order 1──N order_item
                              └── market?     (pickup)

market 1──N market_day        ← horario real por día
```

### FigJam
Añadir caja **`market_day`** al lado de Market (`date`, `open_time`, `close_time`, `market_id`).  
En Market dejar `name` + `total_cost` (y quitar open/close del market si los habías puesto ahí).
