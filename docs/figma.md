# Figma — ArtWithGab (AWG)

Acceso rápido para agentes. **No busques el link**: usa este documento.

## Archivo principal (UI / mockups)

| Campo | Valor |
|-------|--------|
| Qué es | Diseño de gestión ArtWithGab (agenda, nueva venta, pedidos, tracking) |
| URL | https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled |
| **fileKey** (MCP) | `CfdWY2JGaBza9uZHro1qqx` |
| Página | `0:1` (Page 1) |
| Cuenta Figma | Andres Bejarano (`pibepan10@gmail.com`) |

## Board de flujos (FigJam)

| Campo | Valor |
|-------|--------|
| Qué es | Flujos de producto (staff / cliente) |
| URL | https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=0-1 |
| fileKey | `9lexMCksAryAx0vio6OC7D` |
| **Buy custom flow (canónico staff)** | `19:453` — [abrir](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-453) |
| **Entities (modelo v1)** | `19:2599` — [abrir](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=19-2599) |
| Sprint 1 flows (sección antigua) | `12:367` — [abrir](https://www.figma.com/board/9lexMCksAryAx0vio6OC7D/Christmas-2026-web?node-id=12-367) |

> Fuente de verdad del **flujo de venta custom en puesto**: sección **Buy custom flow** (`19:453`), editada por Andresito. El diagrama auto “Staff sale flow v1” en el mismo board es borrador; no lo uses como canon.
>
> `get_metadata` / `get_design_context` **no** aplican a FigJam (`/board/`). Usar `get_figjam` / `get_screenshot` / `use_figma`.

## Convención de IDs

En la URL: `node-id=78-1357` → en MCP: `nodeId=78:1357` (guión → dos puntos).

## Pantallas clave — mid-fi staff (“real-mid” / midfield)

Zona de trabajo actual del staff (frames ~`78:xxx`, fila y≈551). No hay un layer literal llamado `real-mid`; usa estos nodos:

| Pantalla | nodeId | Link |
|----------|--------|------|
| Agenda (mercado / columnas) | `78:848` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=78-848) |
| Agenda del mercado (inner) | `78:849` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=78-849) |
| Agenda Today | `78:1162` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=78-1162) |
| New sale · from navbar | `78:1357` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=78-1357) |
| New sale · Entrega (base) | `78:1415` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=78-1415) |
| New order · Entrega · OK (cabe) | `80:772` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=80-772) |
| New order · Entrega · Reubicar | `80:802` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=80-802) |
| New order · Entrega · No cabe | `80:832` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=80-832) |
| New sale · from calendar | `TODO_NODE_FROM_CALENDAR` | Pedir link al usuario si hace falta |
| Create order | `TODO_NODE_CREATE_ORDER` | Pedir link al usuario si hace falta |

Flujo esperado (staff): **Agenda** → **＋ Crear venta** → **New sale** (desde navbar elige tipo de producto; desde calendario viene preseleccionado) → pedido / cobro.

## Set Quality mid-fi (referencia Sprint 1)

Anotación en canvas: `QUALITY SET — use these frames` (`18:528`). Drafts antiguos están `hidden`.

| Pantalla | nodeId | Link |
|----------|--------|------|
| 1 · Agenda · Quality | `15:681` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=15-681) |
| 2 · New sale · Quality | `16:406` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=16-406) |
| 3 · Customer form · Quality | `17:470` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=17-470) |
| 4 · Tracking · Quality | `17:575` | [abrir](https://www.figma.com/design/CfdWY2JGaBza9uZHro1qqx/Untitled?node-id=17-575) |

Para UI staff nueva, **prioriza** los frames `78:xxx` de arriba; el Quality set es referencia estable del Sprint 1.

## Cómo usarlo con Figma MCP (`plugin-figma-figma`)

1. Leer este archivo; tomar `fileKey` + `nodeId`.
2. Explorar estructura: `get_metadata` con `fileKey` + `nodeId` (o solo `fileKey` para listar páginas).
3. Ver visual: `get_screenshot` con `fileKey` + `nodeId`.
4. Design → código: cargar skill `/figma-design-to-code`, luego `get_design_context` con `fileKey` + `nodeId`.

Ejemplo de parámetros:

```text
fileKey: CfdWY2JGaBza9uZHro1qqx
nodeId:  78:1357
```

## Si falta un node

No inventes `fileKey` ni `nodeId`. Pide al usuario el link de Figma (idealmente con `?node-id=…` de la sección/frame) y actualiza esta tabla.
