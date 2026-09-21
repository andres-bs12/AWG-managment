# Frontend ArtWithGab

React + TypeScript + Vite. Una sola app: sitio público (casita, form, Track) y staff (agenda, nueva venta, pedido).

## Arranque

```bash
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173

- Público: `/` · `/track` · `/form/:token`
- Staff: `/staff/login` → `/staff/agenda`

Cuentas mock (mismos permisos):

- `gaby@artwithgab.com` / `gaby`
- `andres@artwithgab.com` / `andres`

Códigos de demo: `ABS111` (Track). Formulario pendiente: `/form/frm-wait`. Ya enviado: `/form/frm-abs111`.

## Datos

Por defecto `VITE_DATA_SOURCE=mock` (estado en `localStorage`).  
Cuando Spring esté listo: ver [docs/frontend-api-swap.md](../docs/frontend-api-swap.md).

## Scripts

- `npm run dev` — Vite
- `npm run build` — typecheck + production bundle
- `npm run preview` — sirve el bundle
