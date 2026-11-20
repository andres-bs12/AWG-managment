# ArtWithGab (AWG)

Ventas de adornos personalizados, agenda de pintura y entregas para los mercados de Viena de 2026. La tienda web ofrece recogida en mercado y envío por Österreichische Post a toda Austria.

**Producción** · v3.1.0, desplegada el 20 de noviembre de 2026 (etiqueta `v3.1.0`, commit `389a1b3`; Flyway V1–V17).

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
