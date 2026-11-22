# Tareas AWG

## Pendientes tras desplegar v3.1.0 (2026-11-20)

- [ ] **Servidor MCP (conector de Claude) va en la próxima subida** (dueño, 2026-11-22), junto con los correos nuevos. Rama `claude/mcp-server-prototype-c0ceba`, memo `tasks/mcp-server-plan-2026-11-22.md`. Al desplegar: rutas `/mcp`, `/oauth/` y `/.well-known/oauth-` hacia el backend, `MCP_ENABLED=true`, `MCP_PUBLIC_URL=https://artwithgab.com`; luego Claude lo prueba en claude.ai y se lo muestra al dueño.
- [ ] **Dueño · Correos:** confirmar si habrá recogida el viernes 27 de noviembre, cuando hay mercado.
- [ ] **Dueño y asesor · AGB:** confirmar el plazo publicado de siete días para avisar de un adorno dañado.
- [ ] **Asesor · Datenschutz:** revisar si corresponde mencionar el Data Privacy Framework (DPF) de Cloudflare.
- [ ] **Stripe:** completar la compra de prueba con tarjeta 4242 en modo de pruebas y verificar una compra real en producción, incluido el envío por Post y la confirmación en Track.
- [ ] **Correo:** verificar SMTP y comprobar después del despliegue la recepción de la confirmación de pago y del correo «unterwegs» con enlace de seguimiento cuando se registra un número.
- [ ] **Mercados:** decidir si hace falta un campo opcional de dirección para el enlace de Google Maps. Actualmente se busca el nombre del mercado en Viena.
