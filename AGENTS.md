# AGENTS.md — ArtWithGab (AWG)

Seguimiento de ventas de ornamentos de Navidad personalizados (mercados Viena 2026). App real: `frontend/` (Vite + React + TS). Backend Spring: esqueleto en `awg-tracking/`.

## Fase

- **Cerrada:** frontend v1 funcional con mocks (agenda, nueva venta, pedido/pago, form, Track).
- **Actual:** pulir UX staff (jerarquía, botones, flujos visuales). No reabrir reglas de negocio.
- **No ahora:** Spring, Stripe real, emails, Buy web, dashboard, inventario.

## Qué leer (no cargues el resto)

| Tarea | Leer |
|-------|------|
| Staff UX | `docs/staff.md`. Figma mid-fi `78:xxx` vía `docs/figma.md` solo si implementas visual |
| Reglas / entidades | `docs/product.md` |
| Swap API / HTTP | `docs/frontend-api-swap.md` |
| Backend | `awg-tracking/README.md` |
| Arranque local | `frontend/README.md` |

Índice: `docs/README.md`. **No** leas `docs/archive/`, `references/html-mocks/` ni `mocks/` salvo petición explícita.

## Límites

- La UI llama solo a `api` (`frontend/src/api/client.ts`).
- Canon de venta staff: FigJam **Buy custom** `19:453`. HTML mocks no son diseño ni flujo.
- No inventes `fileKey` / `nodeId` de Figma.
- No commitees secretos.
- No toques backend ni swap HTTP a menos que te lo pidan.

## Código

- Named exports (salvo `App.tsx`).
- CSS modules junto al componente. Staff: tokens `--staff-*`, `--font-staff`.
- Staff en inglés; público DE/EN.
- Primitivas: `frontend/src/components/ui` (`Button`, `ButtonLink`, `ChoiceList`, `Field`, `SegmentedControl`) con `tone="staff"`.
