# Plan de sprints ArtWithGab (15 h/semana)

> Archivado. No es contexto de implementación. Vigente: `AGENTS.md` + `docs/product.md`.

Calendario revisado. Cada sprint incluye pruebas y demo.
**Flujo canónico staff custom:** FigJam [Buy custom flow](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-453) (`19:453`) — spec largo en [project-context.md](./project-context.md).
Mocks HTML = wireframe; look navideño cliente por fases.

| Sprint | Fechas | Objetivo |
|--------|--------|----------|
| 1 · Concepto y mockups | 14–20 sep 2026 | Flujos, mocks agenda/venta/form/track. Review con Gaby. |
| 2 · Diseño y base técnica | 21–27 sep 2026 | Spring Boot + PostgreSQL arriba; esqueleto React si aplica; hosting/storage/email con costes. |
| 3 · Configuración y reservas | 28 sep–4 oct 2026 | Staff login, mercados, horarios, capacidad. Primera reserva en agenda. Anti doble reserva. |
| 4 · Pedidos y personalización | 5–11 oct 2026 | Pedido multi-ítem, entregas, finished/custom, QR/form + fotos. |
| 5 · Cobros | 12–18 oct 2026 | Registrar pago en ficha (no pagado / 50% / pagado; efectivo o Stripe). Botones grandes. |
| 6 · Trabajo de Gaby | 19–25 oct 2026 | Ficha ornamento, timer, pausas, reubicación manual. Navbar: custom (pickup→auto slot) o finished. |
| 7 · Seguimiento y entregas | 26 oct–1 nov 2026 | Track por código/token, emails, dirección en envío, lista de entregas. |
| 8 · Completar experiencia | 2–8 nov 2026 | Dashboard, inventario, idiomas, animaciones navideñas cliente. iPad Air / MacBook Air / mobile. |
| 9 · Prueba de mercado | 9–15 nov 2026 | Simulación completa, fallos y usabilidad. |
| 10 · Preparación lanzamiento | 16–22 nov 2026 | Prod, backups, guía de uso. |

---

## Backend por sprint (entidades Java / tablas)

No codear todo el dominio de una. Ir por capas.

### Núcleo comercial (recordatorio)
`Customer` · `Order` · `OrderItem` · `Delivery` · `Payment` (+ `PaymentEvent`)

### Qué toca en cada sprint

| Sprint | Entidades / tablas a tocar | Qué debe quedar usable |
|--------|----------------------------|-------------------------|
| **2** | Ninguna de negocio aún (o solo package vacío). `StaffUser` opcional si ya montas auth. | App Spring arranca; Postgres conectado; migraciones listas (Flyway/Liquibase). |
| **3** | `StaffUser`, `Market`, `MarketScheduleRule` / `MarketDay`, `TimeBlock` | Crear mercado + horario → días en calendario. Colocar un bloque (paint/pause/hold) sin solapar. |
| **4** | `Customer`, `Order`, `OrderItem`, `Delivery`, `OrderItemPhoto` | Crear pedido (custom y/o finished), link/QR form, guardar fotos y datos. Delivery por ítem. |
| **5** | `Payment`, `PaymentEvent` | En la ficha: marcar unpaid / deposit / paid + método. Historial de cobros. |
| **6** | Ajustes en `TimeBlock` + `OrderItem` (estados producción) | Pausas, mover a mano, navbar auto-slot si hay hueco antes del pickup. |
| **7** | Campos/tokens en `Order` (`code`, `track_token`); emails; `Delivery.address` | Track público + “listo para recoger” / domicilio. |
| **8** | `InventorySku`, `InventoryMovement` | Stock blanks / finished. Dashboard lecturas. |

### Orden mental (no invertir)

```
S2  infra
S3  agenda (market → day → time_block) + staff
S4  pedido (customer → order → item → delivery + fotos)
S5  plata (payment)
S6  agenda avanzada (Gaby en puesto)
S7  track + notificaciones
S8  inventario + polish
```

**Regla:** `Order` no cuelga de `StaffUser`. `TimeBlock` (paint) apunta a `OrderItem`, no al revés como dueño del pedido.

---

## Sprint 1 — tareas orientativas para Jira
Objetivo: conceptos y mockups (sin desarrollo de producto todavía).

1. Revisar identidad visual existente de ArtWithGab (colores, tipografía, tono).
2. Dibujar flujo completo: nueva venta → reserva → QR → formulario → pago → seguimiento.
3. Mockup agenda (mercados, capacidad, bloques de tiempo).
4. Mockup pantalla nueva venta / generación de QR.
5. Mockup formulario cliente (fotos, nombre, nota, idiomas DE/EN).
6. Mockup seguimiento por enlace/código con escenas de progreso.
7. Prototipo navegable en Figma.
8. Review con Gaby y lista de ajustes.

Criterios de aceptación Sprint 1: prototipo Figma navegable de las 4 pantallas principales; feedback de Gaby documentado; sin código de app todavía.

## Sprint 2 — foco backend (ahora)
1. Repo `awg-tracking/` en GH (hecho).
2. Postgres local + `application` profile.
3. Flyway/Liquibase vacío o con tabla `staff_user` mínima.
4. Decidir hosting / storage fotos / email (costes).
5. No implementar aún Order/Payment (eso es S4–S5).
