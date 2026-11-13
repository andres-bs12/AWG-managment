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
- `VITE_DATA_SOURCE=http npm run build` — typecheck + production bundle against the real API (also used by Docker and agent checks).
- `npm run build:mock` — explicit local demo/e2e preview; sets `VITE_DATA_SOURCE=mock VITE_ALLOW_MOCK_BUILD=1`. Never publish this bundle: it contains demo credentials and browser-only data.
- `npm run lint` — oxlint
- `npm run preview` — sirve el bundle

Production-mode `vite build` fails unless `VITE_DATA_SOURCE=http` or the local-only escape hatch `VITE_ALLOW_MOCK_BUILD=1` is explicitly set. A missing/misspelled data source must not silently produce a deployable mock. Development still defaults to the mock. Do not put the escape hatch in a deployment environment. `node --test tests/*.test.mjs` checks the build policy and token storage without a browser.

## Customer token storage

Opening `/form/:token` never persists the token. After a successful customer form submission or checkout creation, the API layer stores `{token, savedAt}` under `awg-form-token:<NORMALIZED_CODE>` for 45 days from that save. Reads do not renew the lifetime. Startup and reads delete expired, malformed and undated legacy entries; legacy customers must resubmit their personal form to restore address-edit access. The server's separate expiry (30 days after handover) still takes precedence.

The staff iPad handoff opens `/form/:token?staff=1` after logout; the marker survives reload and suppresses token storage on submission. An active staff session also suppresses storage. Form drafts are removed after submission and staff logout clears every `awg-form-token:*` entry. QR/copy links for a customer's own phone remain ordinary unmarked links. Both HTTP and mock enforce the same token policy for Track and address edits.
