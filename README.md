# ArtWithGab (AWG)

Seguimiento de ventas de ornamentos de Navidad personalizados: pedidos, agenda de pintura, pagos (registro staff / Stripe–efectivo) e inventario.

## Contexto para agentes

Lee primero **[docs/project-context.md](docs/project-context.md)** (producto, stack, flujos, UX y decisiones).
También: [docs/sprint-plan.md](docs/sprint-plan.md) · [docs/figma.md](docs/figma.md) (fileKey y pantallas) · [índice docs/](docs/README.md).

**App real:** [`frontend/`](frontend/) (Vite + React). Arranque: [frontend/README.md](frontend/README.md).  
**HTML antiguo:** [`references/html-mocks/`](references/html-mocks/) (wireframe). No es el diseño final.  
Swap API: [docs/frontend-api-swap.md](docs/frontend-api-swap.md).

## Contexto

Proyecto operativo para la temporada de mercados navideños 2026 (Viena). Stack previsto:

- Backend: Java + Spring Boot (Andresito)
- Frontend: React + TypeScript
- Base de datos: PostgreSQL
- Pagos: registro en gestión (efectivo / Stripe); form del cliente = solo datos

Público v1: **Track** (+ main navideña). **Buy** web self-serve más adelante.

## Cómo se trabaja

1. Sprints semanales (~15 h) gestionados en Jira.
2. Primero funcionamiento + backend; look navideño (cuaderno/Figma) como capa UX sin cambiar reglas.
3. Demo revisable con Gaby al final de cada sprint.
4. No incluir secretos (tokens de Jira, Stripe, etc.) en el repositorio.

## Estado actual

Frontend React en `frontend/` (mocks sustituibles). Backend Java en montaje (`awg-tracking/`). HTML de referencia en `references/html-mocks/`.