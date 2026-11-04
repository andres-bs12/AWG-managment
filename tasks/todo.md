# Tareas AWG

## Hecho

- [x] Frontend v1 con mocks (agenda, venta, pedido, form, Track) y pulido UX staff
- [x] Docs condensados en `docs/README.md`
- [x] 2026-11-04 · Sprint 1 — Backend completo: dominio alineado al contrato del front, servicios portados del mock (agenda, capacidad, sugerencias, ventas, mercados, días de casa, Track, formulario con fotos), auth staff, rate limit, CORS, lock de agenda, 30 tests de integración.
- [x] 2026-11-04 · Sprint 2 — Front conectado por HTTP (`http/services.ts`, proxy Vite), pagos por estado, arreglos de la auditoría (Entregas recarga, errores en Track, copy sin notificación falsa, credenciales demo ocultas, dirección protegida con token).
- [x] 2026-11-04 · Sprint 3 — Tienda web Viena + Stripe Checkout (backend, webhook firmado, expiración, tests) y página `/buy`.
- [x] 2026-11-04 · Sprint 3b — Tienda solo de personalizadas, colores con stock, `/buy` por pasos, auditoría Codex (webhook tardío, fotos huérfanas, timeouts).

## Pendiente (ver `tasks/preguntas-pendientes.md` para decisiones del dueño)

- [ ] Configurar Stripe (claves test → live, webhook) y activar `SHOP_ENABLED`.
- [ ] Notificación al dueño cuando entra un pedido web (email/Telegram) y email de confirmación al cliente.
- [ ] Migraciones Flyway y `ddl-auto=validate` antes de producción.
- [ ] Despliegue: dominio, HTTPS, proxy inverso con front y API en el mismo origen, volumen persistente para `UPLOADS_DIR`, copias de seguridad de Postgres.
- [ ] Páginas legales para la tienda (AGB, Datenschutz/DSGVO, Impressum).
- [ ] Gestión de inventario en la UI (hoy solo hay stock inicial `INITIAL_STOCK`).
- [ ] Cancelaciones/devoluciones (reponer stock vía `OrderItem.inventory`; reembolsos Stripe).
- [ ] Cambio de contraseña del staff.
