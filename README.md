# ArtWithGab (AWG)

Ventas de adornos personalizados, agenda de pintura y entregas para los mercados de Viena de 2026. La tienda web ofrece recogida en mercado y envío por Österreichische Post a toda Austria.

**Producción** · v3.2.0, desplegada el 22 de noviembre de 2026 (Flyway V1–V19).

**`main` (27 nov 2026) va por delante y aún no está desplegado:** tamaños Big/Medium y precios, descuentos y «Change price», «Sold at» para cambiar el mercado de una venta, detalle de pedido simplificado y prueba de esquema con PostgreSQL en CI (Flyway hasta V24). Qué falta y en qué orden: [AGENTS.md → Estado y siguientes tareas](AGENTS.md#estado-y-siguientes-tareas). Reglas de UI que todo cambio debe cumplir: «Lista de revisión de UI» en [AGENTS.md](AGENTS.md).

- **App:** [`frontend/`](frontend/) (Vite + React)
- **Backend:** [`awg-tracking/`](awg-tracking/) (Spring Boot)

[Reglas de producto](docs/README.md) · [API HTTP](docs/frontend-api-swap.md) · [Despliegue](docs/deploy.md) · [Pendientes](tasks/todo.md).

## Quick start (frontend)

```bash
cd frontend
npm install
npm run dev
```

http://localhost:5173 — rutas y cuentas mock: [frontend/README.md](frontend/README.md).
