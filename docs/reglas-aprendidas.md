# Reglas aprendidas — ArtWithGab

**Creado:** 2026-11-12 (v3.1). **Lectura obligatoria** antes de diseñar, arreglar o revisar cualquier cosa del proyecto, junto con `AGENTS.md` y, para UI pública, `docs/design-system.md`.

Este archivo destila lo que salió mal y lo que el dueño corrigió una y otra vez entre v1.0 y v3.0.2. No repite el sistema de diseño: dice **qué revisar** y **qué no volver a hacer**. Cada vez que el dueño corrija algo nuevo, añade aquí la regla (una línea, con fecha) en la sección que corresponda.

## 0. Cómo trabajar

1. **Antes de tocar nada:** `git status`, leer `AGENTS.md`, este archivo y el contrato del componente en `docs/design-system.md`. No sobrescribir cambios locales ajenos.
2. **Buscar todas las copias.** Un texto vive en `frontend/src/i18n/LocaleContext.tsx` en **EN y DE** (y a veces en staff, e-mails del backend o specs E2E). Al quitar o cambiar un texto: `grep` de la clave y del texto en ambos idiomas, quitar la clave, el JSX, el CSS que solo usaba ese elemento y actualizar la aserción E2E (que compruebe que ya no aparece).
3. **Quitar un elemento cambia el espacio.** Al borrar un bloque, comprobar que el hueco entre sus vecinos sigue siendo el token correcto (el elemento borrado a veces aportaba el margen).
4. **Revisión proporcional al cambio (dueño, 2026-11-12).** No repasar todo el proyecto por un cambio pequeño: un texto quitado se verifica con build/lint, la prueba que lo cubre y las capturas de esa pantalla. La revisión amplia (todas las pantallas, suite E2E completa, auditoría cruzada) se hace cuando el cambio toca componentes compartidos, flujos, backend o seguridad, y **siempre antes de desplegar**. El agente decide el alcance y lo dice en el resumen.
5. **E2E en verde no es una revisión de UX.** Después de cualquier cambio público: capturas de cada pantalla afectada (directamente o por texto/componente compartido) a 360 y 1280 px, leídas una por una, antes de decir «listo».
6. **Decir la verdad sobre lo verificado.** Si no se corrió Playwright, navegador, PostgreSQL, Stripe real o iPhone real, decirlo explícitamente. Nunca afirmar que se envió un e-mail, que un pago está confirmado o que una auditoría aprobó algo si no ocurrió.
7. **Versiones:** cada versión nueva lleva número (`frontend/package.json` + etiqueta git `vX.Y.Z` al desplegar). Rama `release/vX.Y` en GitHub; **no desplegar a producción (artwithgab.com) sin orden explícita del dueño.** Subir a GitHub sí está permitido cuando lo pide.
8. **Auditoría cruzada:** nunca revisa el mismo LLM que escribió el código. Opus planifica y verifica; el reparto está en `docs/agent-routing.md`.
9. Código, comentarios e identificadores en inglés; respuestas al dueño en español latinoamericano.

## 0.1 Flujo rápido y barato (dueño, 2026-11-12: «ahorrar tokens, resultados de alta calidad»)

**Niveles de prueba** (scripts en `frontend/package.json`):

| Cuándo | Qué | Tiempo |
|---|---|---|
| Después de cada edición | `npm run check` (tsc + lint + tests Node) y **solo** la spec de la pantalla tocada en un proyecto: `npx playwright test e2e/<spec> --project=desktop` | 1–2 min |
| Al cerrar un bloque | `npm run test:changed` (specs cambiadas en desktop, mobile y staff 360) | 3–8 min |
| Cada push a `release/*` o `main` (automático) | CI `e2e-quick`: todas las specs en desktop, mobile, phone-360x640 y staff-phone-360x640 (~270 pruebas) | ~10 min |
| **Al final de la versión, antes de desplegar** (obligatorio) | CI `e2e-full`: suite completa (~717) repartida en 4 máquinas. Se lanza a mano: GitHub → Actions → CI → «Run workflow», o `gh workflow run CI --ref release/vX.Y`; luego `scripts/ci-wait.sh`. No se despliega sin este run en verde para el commit exacto que se sube; `deploy/deploy.sh` lo comprueba y se niega a desplegar si falta (solo emergencias: `AWG_SKIP_CI_CHECK=1`) | ~12 min |

**Reglas del flujo:**
1. **Quien cambia un comportamiento actualiza su prueba en el mismo encargo** y la corre. Nunca dejar pruebas viejas para el final (v3.1 acumuló 54 fallos por esto).
2. **Un archivo, un agente.** Repartir por conjuntos de archivos que no se tocan; cada agente arranca su propio servidor en un puerto propio (`PW_PORT`), así nadie espera a nadie.
3. **Modelo según la tarea:** Haiku para trabajo acotado/mecánico; Opus para auditorías visuales y pantallas complejas; Codex (si tiene créditos) para auditar código escrito por Claude o implementar lo complejo; GLM-5.3 para auditar backend. Fable solo como último recurso.
4. **Una auditoría amplia por versión** (al empezar) y **una auditoría cruzada de código** al final. No auditar después de cada cambio.
5. **Informes cortos:** cada agente entrega ≤ 250 palabras (archivos, decisiones, resultados, rutas de capturas). El PM no lee transcripciones ni logs completos: solo resúmenes y como mucho 2 capturas por área.
6. **Capturas visuales** (`a11y-visual`) se regeneran y revisan **una vez**, al final de la versión.
7. **Commit y push de respaldo** al terminar cada bloque grande (en la rama `release/vX.Y`), sin desplegar.
8. Plantilla de encargo: `docs/agent-routing.md` → «Plantilla de encargo».
9. **Después de cada push, vigilar el CI hasta su resultado:** `scripts/ci-wait.sh` en segundo plano (sale con error si el run falla o no aparece). Una lista vacía de `gh run list` es un error que se investiga, nunca «todavía no corrió». No se dice «subido» ni se cierra el turno sin informar el resultado del CI; si falla, se corrige en el mismo turno. (Dueño, 2026-11-12: el E2E falló en GitHub y nadie se enteró.) `ci-wait.sh` espera todos los runs del commit: el del PR salta `e2e`, así que un run verde solo no prueba nada; mirar que `e2e-quick` (o `e2e-full` antes de desplegar) aparezca como `success`, no `skipped`.
10. **Varios agentes a la vez, en ramas de `release/vX.Y`** (dueño, 2026-11-12):
    - Cada agente trabaja en **su propio worktree** con una rama que sale de `release/vX.Y` (por ejemplo `feat/v3.1-<tema>`). Nunca en la carpeta principal ni en la rama `release/vX.Y` directamente mientras otro agente la usa.
    - Puerto propio para Playwright: `PW_PORT=5201` (5202, …); 5199 queda para la sesión principal.
    - Archivos separados: antes de empezar, el encargo dice qué archivos toca; dos agentes no editan el mismo archivo.
    - En su rama el CI corre backend + frontend (tsc, lint, Node) en cada push; la suite E2E completa **no** corre ahí: correr `npm run test:changed` local, o lanzarla en GitHub → Actions → CI → «Run workflow» eligiendo la rama.
    - Al terminar: `git merge release/vX.Y` en su rama (nunca rebase ni force-push), `npm run check`, push de su rama, `scripts/ci-wait.sh`, y solo entonces se integra en `release/vX.Y` (merge o PR hacia `release/vX.Y`). Nunca desplegar.
    - Seguir el resto de §0.1 (pruebas de lo que cambia en el mismo encargo, informe ≤ 250 palabras) y leer `AGENTS.md` y este archivo al empezar.

## 1. Textos (copy) — lo que el dueño más corrige

- **Menos es más.** El dueño quitó repetidamente frases de relleno o de «tranquilidad»: la lista «Handbemalt · abends · Stripe», el aviso «sin reembolso» bajo el nombre (2026-11-12) y la promesa «Once your payment is confirmed, I paint your ornaments in time for your delivery day» del checkout (2026-11-12). **No añadas frases que expliquen el proceso, prometan plazos o tranquilicen** si el cliente no las necesita para decidir. Ante la duda, no la pongas y pregunta.
- **Nunca prometer lo que el sistema no garantiza** (P6 del sistema de diseño): una fecha de la API no es una reserva, volver de Stripe no es pago confirmado, una petición no es un e-mail entregado. La página de gracias solo menciona el e-mail si `confirmationEmail` es `true`.
- **Nunca repetir la misma frase en una pantalla** (incluido texto solo para lectores de pantalla que se anuncia junto).
- **Singular/plural siempre**: «Kugel/Kugeln», «Abholtag/Liefertag», «Gestalte Kugel 1 von 2» solo con 2+; con una sola Kugel no hay «Kugel 1 von 1» ni resumen de nombre.
- **Alemán por defecto**, «du/dein», Gaby en primera persona sin empalagar; inglés británico. Nunca texto inglés del servidor en una página alemana (traducir códigos con `lib/apiError.ts`).
- **Texto legal:** no inventarlo. Pendiente del asesor.
- **Cada acción dice lo que hace** («Kugel Luna ändern», no «Ändern» suelto); una sola acción «… ändern» por tarjeta de revisión.

## 2. Espaciado y geometría

- **Solo tokens** (`--space-1…10` = 4/8/12/16/24/32/48/64/80/96). Prohibido 10, 14, 18, 20 px o tolerancias «±2 px». El centrado es exacto por construcción.
- **Ritmo de formulario:** label→hint 4 · label/hint→control 8 · control→error 8 · campo→campo 24 · grupo→grupo 32 · sección→sección 32 con divisor de 1 px centrado · título de sección→contenido 16 · tarjeta→tarjeta 16 · botones en grupo 12 · **último contenido→barra de acciones 24** (también al final de la tarjeta).
- **Un solo dueño del espacio:** el padre pone el `gap`; los hijos no tienen márgenes externos. Nunca sumar márgenes a gaps ni cancelarlos con márgenes negativos (salvo el caso documentado: filas táctiles de 44 px con `margin-block` negativo para no romper el ritmo de 32).
- **Relacionado más cerca que no relacionado** (al menos un paso de la escala). Nada pegado (botón «+ Kugel» contra una ficha).
- **Sin huecos muertos:** ningún `min-height` (columnas sticky de alto de pantalla) debe estirar una fila y dejar espacio antes de las acciones. Medir el hueco a 360/768/1280.
- **Padding simétrico** y ópticamente centrado; chips de un grupo con la misma altura.
- **Objetivos táctiles ≥ 44 px**, controles 48 px, botones grandes de staff 56 px. La «x» de quitar foto no tapa la foto: glifo pequeño en la esquina con área de 44 px que sobresale.
- **Ningún texto se sale de su tarjeta** (dueño, 2026-11-12, Statistics): toda celda de texto lleva `min-width: 0` y `overflow-wrap: anywhere`, y las pruebas comparan el ancho del texto con el de su contenedor a 320/360/390/1280 px. Nada de pistas largas dentro de tiles estrechos: van en una línea aparte o en un (?).
- **Páginas densas en móvil se filtran, no se apilan:** si una pantalla pasa de unas dos pantallas de teléfono, agrupar con un filtro segmentado (p. ej. Sales · Customers · Website) y mostrar todo junto solo desde 1024 px. Tiles de una fila con la misma altura.
- **Medir, no mirar:** `getBoundingClientRect` y estilos computados en el navegador.

## 3. Color y selección

- **Un único estilo de selección:** borde `--color-selected` (#14553a) + fondo `--color-selected-surface` (#e9f4ee). Nunca azul para seleccionar (azul = carrito/precio, `--color-cart-*`), nunca borde negro grueso, sin ✓, sin anillo extra dentro.
- **Colores de adorno:** `red`/`green`/`beige` con acabado `shiny`/`matte`; gris y blanco solo para datos antiguos. Usar el mapa compartido de colores con etiquetas antiguas.
- **Contraste** según §2.3 del sistema de diseño; texto sobre la escena del Home en blanco con sombra azul y casillas azul marino casi opacas.
- **Esquinas suaves en todo** (radios `--radius-*`), nada a 90°.
- Sin decoración sin explicación (círculos, puntos, flechas → en tarjetas seleccionables). Expandir/colapsar con chevron.

## 4. Móvil, Safari e iPhone

- **Probar todas las páginas públicas** a 320×480, 360×640, 375×553, 393×659, 412×780, 440×741, 768×1024, iPad 820×1180/1180×820 y 1280×800. CTAs completamente visibles, nada recortado, sin scroll horizontal.
- **Playwright/WebKit no emula el safe-area del iPhone** (`env(safe-area-inset-bottom)` es 0 allí, ~34 px en un iPhone real). Cualquier padding con safe-area se quita cuando el elemento no está en el borde (p. ej. barra acoplada al final de la tarjeta).
- **Barras de Safari iOS 26:** las capas fijas a pantalla completa van con z-index negativo (`WinterBackdrop` −2, `Snowfield` −1) dentro de `.shell` con `isolation: isolate`. No subir esos z-index, no pintar fondos en capas fijas que toquen el borde, no usar franjas fijas/sticky para teñir (Safari las vuelve opacas, probado y revertido). Scroll del documento, no de un contenedor.
- **Barra de acciones:** sticky solo en pasos de edición; en revisión/pago va en el flujo al final (una pila alta de pagar/Stripe/atrás tapaba el resumen). Al final del scroll se integra con la tarjeta: mismo ancho, esquinas a ras, nunca «píldora dentro de píldora». En móvil flota 8 px sobre el borde.
- **Hover solo para punteros finos** (`@media (hover: hover)`): en iPad/iPhone el hover se queda pegado tras tocar.
- `crypto.randomUUID` no existe en HTTP plano por LAN en iPhone: usar el fallback `uid()`.
- Las capturas de página completa congelan la barra sticky a mitad de página y simulan un hueco falso: el spec visual la pone en flujo durante la captura.
- Las capturas visuales antiguas pueden pasar por error: cuando cambia la UI, borrarlas, regenerarlas y revisarlas a ojo. No subir tolerancias ni relajar reglas axe.

## 5. Estructura de la tienda y del formulario (decisiones vigentes)

- `/buy`: tres pantallas (diseño → entrega → revisión), sin subpasos en móvil; una Kugel = una página. «Weiter» lleva al primer campo que falta de la primera Kugel incompleta.
- Con 2+ Kugeln: fichas lado a lado «In deiner Bestellung»; con una sola, solo «Weitere Kugel hinzufügen». Las etiquetas reflejan lo que escribió el cliente (nombre en vez de «Kugel 1»).
- Vista previa: gato/perro ilustrado, **nunca la foto subida**; fondo teñido por el color; giro de esfera; nombre en cursiva artística. En móvil la vista previa grande no es sticky.
- Solo el nombre pagado del reverso es editable (máx. 6 letras); también es `petName`. No volver a pedir el nombre del animal por separado.
- Tarjetas de revisión compactas: un «… ändern» junto al título, atributos combinados («Rot · Glänzend»), sin repetir el nombre, fotos sin título.
- Un atajo «Frühester Termin» + calendario, no varios atajos casi iguales.
- Restricciones explicadas una vez, junto a la decisión, con (?) (p. ej. solo Viena). Ayudas (?) junto a lo que explican, nunca sueltas bajo un párrafo.
- `/form` se usa en el iPad del puesto por gente mayor: extremadamente claro; tras guardar, ir a `/track/CODE`.
- Escala de valoración: opciones de igual ancho en una fila, etiquetas de los extremos bajo 1 y 5, se bloquea tras responder.
- Datos demo con el camino feliz (sin colores agotados salvo para probar ese estado).

## 6. Seguridad — no repetir

- **Nada de secretos en commits**; `.env` solo de root en el servidor.
- **El servidor calcula precios y valida todo**; el cliente nunca decide importes ni disponibilidad.
- **Toda reserva de tiempo de pintura/stock toma `ScheduleLock`** (fila 1). Métricas usan su propia fila (2). No tomar el lock antes de autorizar (era un oráculo de existencia).
- **Endpoints públicos que envían e-mail son un relay en potencia:** pedidos web `PENDING`/`REVIEW` no aceptan escrituras públicas (409 `PAYMENT_PENDING`) ni reciben correo; correos de edición agrupados (1 por pedido/15 min); cupos de lista de espera (3/cliente/h, 30/h, 200/día) comprobados antes de buscar al suscriptor; nunca meter texto libre del cliente en saludos de correos que puede disparar un tercero.
- **Rate limits pensados para IPv6** (/64), fallos de login por cuenta+cliente (no bloquear al staff real por cuenta), presupuesto global contra enumeración en Track, limpieza periódica (no `removeIf` por petición).
- **Cuerpos acotados:** nginx 64 KiB por defecto, 64 MB solo en checkout y formularios; webhook comprueba cabeceras antes de leer (256 KiB); JVM con techo de heap y salida en OOM.
- **Logs sin datos personales:** de SMTP solo clase de excepción y código.
- **Tokens del formulario** se guardan solo tras éxito, con caducidad (45 días); el iPad del puesto (`?staff=1`) no guarda nada; logout de staff borra `awg-form-token:*`.
- URL de checkout aceptada solo si es del mismo origen o `https://checkout.stripe.com`.
- Fotos JPEG/PNG se decodifican completas antes de guardarse; truncadas se rechazan (`PHOTO_INVALID`).
- **Migraciones Flyway:** nunca editar ni reutilizar números ya aplicados en producción (V1–V13). Un cambio de entidad necesita migración nueva. Backup antes de cada despliegue.
- Build de producción solo con `VITE_DATA_SOURCE=http`; `build:mock` nunca se despliega.
- Tras desplegar algo que toca pagos: la compra de prueba 4242 sigue pendiente (ver `docs/checklist-lanzamiento.md`).

## 7. Staff

- Inglés, formato de dinero inglés, botones grandes de 56 px, diálogos con una **X arriba a la derecha** (44 px), Escape y toque fuera para cerrar sin actuar; ya no hay botón «Not yet» (dueño, 2026-11-12: le hacía perder tiempo), sin texto repetido (fecha/subtítulo/colores junto a muestras).
- Separadores (·) nunca empiezan una línea (`StaffText`). Hover solo en dispositivos con hover.
- Lo que el staff guarda se guarda solo (autoguardado) y avisa de conflictos (`STOCK_CHANGED`, `@Version`).

## 8. Registro de correcciones nuevas

Añadir aquí, con fecha, cada corrección nueva del dueño hasta integrarla en la sección de arriba.

- 2026-11-12 (v3.1): Statistics en móvil: texto que se salía de los tiles y página demasiado larga → filtro por secciones y resumen compacto (§2).
- 2026-11-12 (v3.1): diálogos de staff se cierran con X, Escape o toque fuera; «Not yet» eliminado.
- 2026-11-12 (v3.1): quitar del checkout la promesa de plazo de pintura tras el pago (EN y DE). Regla general en §1.
- 2026-11-12 (v3.1): el CI falló tras un push (runner Ubuntu 26.04) y no se detectó porque `gh run list` vacío se tomó como «no empezó». Regla 9 de §0.1 y `scripts/ci-wait.sh`.
