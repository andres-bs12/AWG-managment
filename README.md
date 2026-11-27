# ArtWithGab (AWG)

Ventas de adornos personalizados, agenda de pintura y entregas para los mercados de Viena de 2026. La tienda web ofrece recogida en mercado y envío por Österreichische Post a toda Austria.

**Producción** · `main` 72eb858, desplegada el 27 de noviembre de 2026 (Flyway V1–V24): tamaños Big/Medium y precios, descuentos y «Change price», «Sold at», detalle de pedido simplificado.

**`main` (27 nov 2026, tras 72eb858) aún no está desplegado:** Deliveries solo con días que tienen entregas, Sales con filtro de mercado y totales Card/Cash/Due, foto de venta → Stock y flecha propia en los desplegables. Sin migraciones nuevas. Qué falta y en qué orden: [AGENTS.md → Estado y siguientes tareas](AGENTS.md#estado-y-siguientes-tareas). Reglas de UI que todo cambio debe cumplir: «Lista de revisión de UI» en [AGENTS.md](AGENTS.md).

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
