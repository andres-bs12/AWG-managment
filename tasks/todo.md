# Tareas AWG

## Hecho

- [x] 2026-11-05 · SEC-F — implementación de M1/L5 y hardening barato I2/I4/I5; política compartida de tokens HTTP/mock, protección de la entrega del iPad, build HTTP obligatorio y escape local, meta referrer, documentación HSTS y CORS. E2E ampliados; validación de navegador pendiente. Ver `docs/sec-f-handoff.md`.

- [x] 2026-11-05 · Task 11 — implementación de staff (P0/P1 solicitados, mock/HTTP, capa de diseño y suite escrita). Build/lint, 23 pruebas Node y 92 backend pasan. Sin Playwright ni commits; detalles y matriz en `docs/task11-staff-handoff.md`.

- [x] 2026-11-05 · Task 8 — implementación QR de dos pantallas y componentes compartidos con `/buy`, DE/EN, errores/foco, borrador/fotos y estados de enlace; suite `e2e/form.spec.ts` escrita. Validación de navegador pendiente; ver `docs/task8-form-handoff.md`.

- [x] Frontend v1 con mocks (agenda, venta, pedido, form, Track) y pulido UX staff
- [x] Docs condensados en `docs/README.md`
- [x] 2026-11-04 · Sprint 1 — Backend completo: dominio alineado al contrato del front, servicios portados del mock (agenda, capacidad, sugerencias, ventas, mercados, días de casa, Track, formulario con fotos), auth staff, rate limit, CORS, lock de agenda, 30 tests de integración.
- [x] 2026-11-04 · Sprint 2 — Front conectado por HTTP (`http/services.ts`, proxy Vite), pagos por estado, arreglos de la auditoría (Entregas recarga, errores en Track, copy sin notificación falsa, credenciales demo ocultas, dirección protegida con token).
- [x] 2026-11-04 · Sprint 3 — Tienda web Viena + Stripe Checkout (backend, webhook firmado, expiración, tests) y página `/buy`.
- [x] 2026-11-04 · Sprint 3b — Tienda solo de personalizadas, colores con stock, `/buy` por pasos, auditoría Codex (webhook tardío, fotos huérfanas, timeouts).

- [x] 2026-11-05 · Goals 1–5 — revisión del PR, Flyway (V1–V3, `ddl-auto=validate`), Docker/compose verificado, cambio de contraseña, cancelar pedido (repone stock y libera horas), rutas diferidas, páginas legales.
- [x] 2026-11-05 · Sprint 4 — respuestas del dueño: stock editable (`/staff/inventory`), días de pintura con interruptor y máximo, fin de temporada 24-dic + "Santa ya salió" con lista de espera, depósito con importe, códigos `AWG`+6, e-mails al dueño y al cliente (sin SMTP no se envían), borradores legales DE/EN, kit de Stripe.
- [x] 2026-11-05 · Sprint 6 — respuestas del dueño: colores rojo/verde/beige con acabado brillante o mate (stock por combinación), entregas web desde el 30-nov, enlace del formulario caduca 30 días tras la entrega, Track sin nombres para códigos antiguos, borrado de datos personales y fotos 60 días tras la entrega, doble opt-in de la lista de espera, rediseño UX de `/buy` (`docs/sprint6-buy-ux.md`), guía `docs/siguiente-fase.md`.
- [x] 2026-11-05 · Sprint 5 — auditoría final doble (Claude + Codex: UI, UX, seguridad; `tasks/audit-final.md`), arreglos backend y frontend con revisión cruzada, códigos de error estables, ventas idempotentes, revisión de pagos, cabeceras de seguridad, fuentes locales.

## Pendiente (ver `tasks/preguntas-pendientes.md` para decisiones del dueño)

- [ ] SEC-F: Claude debe ejecutar la suite actual, incluidos `form.spec.ts`, `success.spec.ts` y `staff-review.spec.ts`, y comprobar tokens tras envío/checkout, edición de dirección, expiración, recarga y logout sin red. Mantener axe y las nueve referencias presentes. Ver `docs/sec-f-handoff.md`. HSTS queda por configurar/verificar en el proxy TLS real; el conflicto previo de tipos Playwright/axe sigue abierto.

- [ ] Fix e-4 (seguimiento actual, sustituye e-1/e-2/e-3): referencias preparadas; Claude debe repetir normalmente los 383 casos conservando los nueve PNG ya regenerados, revisados e idénticos byte a byte a los `*-actual.png`, sin borrarlos ni `--update-snapshots`. Último resultado externo: 378 aprobados, 3 fallidos exclusivamente por referencias ausentes, 2 omitidos; el foco de fotos ya no falla. No se cambió app/tests/axe. Build/lint y 23 pruebas Node pasan; sin Playwright ni commits aquí. Revisar contenido desplazable además de comparar los PNG. Ver `docs/ux-validation.md`.

- [ ] Task 11: Claude debe ejecutar `staff-review.spec.ts` en ipadPortrait/ipadLandscape/desktop (34 casos, 102 ejecuciones previstas), verificar axe cero en todas las páginas, teclado/toque, 390px, 820×1180/1180×820, HTTP real y cambios visuales. Revisar DTOs añadidos antes de desplegar el frontend. Stylelint binario pendiente de instalar cuando haya red; el lint de tokens está activo. P1-14/17/18/22 pendientes del dueño; P2-21 historial/referencia Stripe y P2-24 back-off por cuenta no implementados. Ver `docs/task11-staff-handoff.md`.

- [ ] Seguimiento histórico Fix b-2 / Task 8: la ejecución externa más reciente (378 aprobados de 383, Fix e-4) no registra de nuevo el fallo axe móvil; las trazas visuales actuales solo muestran referencias ausentes. Revisar el calendario y la barra durante el scroll; conservar las capturas ya regeneradas. El seguimiento vigente de navegador es Fix e-4 en `docs/ux-validation.md`, sin debilitar los checks.

- [ ] Seguimiento histórico Fix b-1 / Task 8: Claude debe repetir la suite de 193 ejecuciones, validar el foco y envío del código postal con ratón, teclado y táctil, y regenerar y revisar las nueve referencias visuales eliminadas por instrucción del dueño. Revisar DE/EN, axe, recarga, enlaces, varias Kugeln/finished, 360×640/reflow/zoom y regresiones de `/buy`. Handoff en `docs/task8-form-handoff.md`.

- [ ] Task 7B: Claude debe ejecutar la suite actualizada (incluido `e2e/design-system.spec.ts`), revisar capturas DE/EN a 360/768/1280 px, la guía `/dev/design` y reflow/zoom del calendario. Implementación terminada; handoff en `docs/task7b-handoff.md`. Mantener checks de accesibilidad y no aceptar capturas automáticamente.

- [ ] 2026-11-05 · Fix 12 **parcial, pendiente de validar**: Claude informó 121 aciertos y un fallo de axe en escritorio. La traza identifica la ayuda de fotos y el contador; el fundido de entrada de `optionsPane` reduce temporalmente su contraste a 2,86:1. La entrada conserva ahora solo el deslizamiento, con texto totalmente opaco y movimiento reducido sin animación. No se modificaron tests ni aserciones. Build y lint pasan (advertencias existentes). No se ejecutó Playwright por instrucción del dueño; Claude debe repetir la suite y revisar capturas antes de cerrar el fix. Sustituye el seguimiento pendiente de Fix 11.
- [ ] `/buy` premium: verificar en navegador a 360/768/1280 px y completar las mejoras y pruebas de `docs/plan-buy-premium.md`.
- [ ] Stripe: `stripe login`, claves de prueba, prueba real del checkout y webhook (`docs/stripe-setup.md`); luego claves live y `SHOP_ENABLED=true`.
- [ ] SMTP (`MAIL_*`, `OWNER_EMAIL`) y prueba real de los e-mails.
- [ ] Despliegue: proveedor, dominio, HTTPS, copias de seguridad de Postgres (`docs/deploy.md`).
- [ ] Datos reales en los textos legales y revisión por un asesor.
- [ ] Dominio y correo (buzón + SMTP transaccional): ver `docs/siguiente-fase.md`.
- [ ] Stock real de las 6 combinaciones (rojo/verde/beige × brillante/mate) en `/staff/inventory`.
- [ ] Asesor legal: botón "Zahlungspflichtig bestellen", exclusión de desistimiento de personalizados (§ 18 FAGG), plazos de borrado (60 días; 7 años contabilidad).
- [ ] **Futuro — lista de espera:** pantalla de staff para ver los e-mails confirmados y envío automático al abrir la temporada 2027 (el doble opt-in ya existe).
- [ ] **Futuro — avisos inteligentes con agentes**, cuando todo esté en producción.
- [ ] Pendientes menores de la auditoría (UI): contraste medido en todas las pantallas, bloques de error con reintento homogéneos, revisión completa de diálogos y etiquetas accesibles.

- [ ] Sprint 6 /buy Task 2: verificar visualmente y con teclado en 360 px y escritorio, probar Stripe real (éxito, demora y cancelación), aplicar V6 en PostgreSQL y revisar la contención del lock de agenda usado por métricas. Falta auditoría cruzada; las pruebas automáticas no sustituyen estas verificaciones.
- [ ] Sprint 6 /buy Task 3: ejecutar y corregir la suite Playwright fuera del sandbox, revisar y generar capturas de referencia, completar los casos y mediciones pendientes detallados en `docs/ux-validation.md`, y realizar la prueba moderada.
- [ ] Task 5A: Claude debe ejecutar los nueve casos escritos de `e2e/success.spec.ts` en 360/768/1280 px (pago, espera, calendario, SEQ, cancelación y privacidad). No ejecutados aquí; revisar también el conflicto previo de tipos Playwright/axe en `helpers.ts:45`. El mock ya expone métricas en memoria para probar privacidad sin omitir casos.
- [ ] Task 5B: Claude debe ejecutar los siete casos escritos de `e2e/keyboard-availability.spec.ts`: teclado completo de escritorio, Tab/Shift+Tab sin controles ocultos ni solapados, fecha agotada y opciones agotadas DE/EN, fallo de red al reconsultar. Verificar los arreglos de foco, Enter y recuperación de calendario a 360/768/1280 px. Build y lint pasan; Playwright no se ejecutó por instrucción del dueño. Persiste el conflicto previo de tipos Playwright/axe en `helpers.ts:45`.
- [ ] Task 5C: Claude debe ejecutar los siete casos completos de `e2e/journey-deep.spec.ts` en los cuatro proyectos (incluido movimiento reducido): checkout multipart exacto DE/EN, dos adornos/retirada, nombre/giro/precio, latencia, historial y recarga. Sin omisiones; cinco muestras de color y de la opción de nombre por proyecto, mediana < 100 ms (medición desde el clic en el documento, sin demora del driver/táctil). Verificar el historial nuevo de las tres pantallas y que recargar vuelve al diseño para reañadir fotos. Sin ejecutar Playwright aquí por instrucción del dueño; no se modificaron otros specs. La comprobación TypeScript del spec solo informa del conflicto previo de tipos Playwright/axe en `helpers.ts:45`.
