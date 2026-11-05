# Tareas AWG

## Hecho

- [x] Frontend v1 con mocks (agenda, venta, pedido, form, Track) y pulido UX staff
- [x] Docs condensados en `docs/README.md`
- [x] 2026-11-04 · Sprint 1 — Backend completo: dominio alineado al contrato del front, servicios portados del mock (agenda, capacidad, sugerencias, ventas, mercados, días de casa, Track, formulario con fotos), auth staff, rate limit, CORS, lock de agenda, 30 tests de integración.
- [x] 2026-11-04 · Sprint 2 — Front conectado por HTTP (`http/services.ts`, proxy Vite), pagos por estado, arreglos de la auditoría (Entregas recarga, errores en Track, copy sin notificación falsa, credenciales demo ocultas, dirección protegida con token).
- [x] 2026-11-04 · Sprint 3 — Tienda web Viena + Stripe Checkout (backend, webhook firmado, expiración, tests) y página `/buy`.
- [x] 2026-11-04 · Sprint 3b — Tienda solo de personalizadas, colores con stock, `/buy` por pasos, auditoría Codex (webhook tardío, fotos huérfanas, timeouts).

- [x] 2026-11-05 · Goals 1–5 — revisión del PR, Flyway (V1–V3, `ddl-auto=validate`), Docker/compose verificado, cambio de contraseña, cancelar pedido (repone stock y libera horas), rutas diferidas, páginas legales.
- [x] 2026-11-05 · Sprint 4 — respuestas del dueño: stock editable (`/staff/inventory`), días de pintura con interruptor y máximo, fin de temporada 24-dic + "Santa ya salió" con lista de espera, depósito con importe, códigos `AWG`+6, e-mails al dueño y al cliente (sin SMTP no se envían), borradores legales DE/EN, kit de Stripe.
- [x] 2026-11-05 · Sprint 5 — auditoría final doble (Claude + Codex: UI, UX, seguridad; `tasks/audit-final.md`), arreglos backend y frontend con revisión cruzada, códigos de error estables, ventas idempotentes, revisión de pagos, cabeceras de seguridad, fuentes locales.

## Pendiente (ver `tasks/preguntas-pendientes.md` para decisiones del dueño)

- [ ] Stripe: `stripe login`, claves de prueba, prueba real del checkout y webhook (`docs/stripe-setup.md`); luego claves live y `SHOP_ENABLED=true`.
- [ ] SMTP (`MAIL_*`, `OWNER_EMAIL`) y prueba real de los e-mails.
- [ ] Despliegue: proveedor, dominio, HTTPS, copias de seguridad de Postgres (`docs/deploy.md`).
- [ ] Datos reales en los textos legales y revisión por un asesor.
- [ ] Colores reales de los adornos.
- [ ] Decisiones de la auditoría: caducidad de enlaces del formulario, datos de Track con códigos antiguos, retención/borrado, doble opt-in de la lista de espera.
- [ ] Pendientes menores de la auditoría (UI): contraste medido en todas las pantallas, bloques de error con reintento homogéneos, revisión completa de diálogos y etiquetas accesibles.
