# Frontend ArtWithGab

React + TypeScript + Vite. Una app: sitio público (casita, form, Track) y staff (agenda, nueva venta, pedido). Datos mock por defecto.

## Arranque

```bash
cd frontend
npm install
npm run dev
```

http://localhost:5173

## Rutas y demo

- Público: `/` · `/buy` (placeholder) · `/track` · `/form/:token`
- Staff: `/staff/login` → `/staff/agenda` · `/staff/sales/new` · `/staff/orders/:id`

Cuentas mock (mismos permisos): `gaby@artwithgab.com` / `gaby` · `andres@artwithgab.com` / `andres`.

Códigos Track (demo):

| Código | Tipo | Estado track |
|--------|------|----------------|
| `ABS100` | Pickup | In the workshop |
| `ABS101` | Pickup | Ready to pick up |
| `ABS102` | Pickup | Handed over |
| `ABS103` | Vienna | In the workshop |
| `ABS104` | Vienna | Out for delivery |
| `ABS105` | Vienna | Handed over |

Extras: `ABS106` not started · `ABS107` multi-ítem (sigue en workshop) · Form pendiente `/form/frm-wait` · Form enviado `/form/frm-abs100`.

`VITE_DATA_SOURCE=mock` (default). Store: `localStorage` `awg-mock-store-v11`. Swap Spring: [docs/frontend-api-swap.md](../docs/frontend-api-swap.md).

## Mapa `src/`

```
src/
  api/          client.ts → mock | http; contracts.ts
  domain/       types.ts (FigJam Entities)
  auth/         AuthContext (token awg-staff-token)
  i18n/         DE/EN solo público
  layouts/      PublicLayout · StaffLayout + StaffGuard
  pages/public/ Home, Buy placeholder, Form, Track
  pages/staff/  Login, Agenda, NewSale, OrderDetail, Paint, saleDraft.ts
  components/   public/ (escena) · staff/ · ui/ (Button, Field, …)
  styles/       tokens.css · global.css
```

Contexto del proyecto: [docs/README.md](../docs/README.md).

## Scripts

- `npm run dev` — Vite
- `npm run build` — typecheck + bundle
- `npm run lint` — oxlint
- `npm run preview` — sirve el bundle
