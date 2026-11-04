# Preguntas pendientes para el dueño

Decisiones que tomé con un valor por defecto razonable para no bloquear el trabajo. Revísalas y dime si cambio alguna. (2026-11-04)

## Producto

1. **Colores de los adornos.** El front vende rojo y gris; el backend tenía RED/GREEN/WHITE. Añadí GREY y solo hay stock de rojo y gris. ¿Cuáles son los colores reales?
2. **Stock.** Al arrancar se crean 200 unidades por color y 200 terminados (`INITIAL_STOCK`). Si llega a 0, la venta se bloquea y no hay pantalla para reponer. ¿Quieres una pantalla de inventario o prefieres no bloquear por stock?
3. **Festivos.** Los días de pintura en casa se generan de lunes a viernes, incluidos 8, 24, 25, 26 y 31 de diciembre y 1 de enero. ¿Los quito?
4. **Adorno terminado vendido "ahora".** Si no tiene hora de recogida, se acepta y se entrega hoy. ¿Correcto?
5. **Depósito.** Sigue siendo exactamente el 50 %; no se guardan importes parciales distintos. ¿Lo mantienes?

## Tienda web

6. **Coste de envío.** Ahora es 0 € (`SHOP_DELIVERY_FEE`). ¿Cuánto cobras por el envío en Viena?
7. **Antelación.** La pintura empieza como pronto mañana y se ofrecen días hasta 45 días vista. ¿Quieres más margen (p. ej. 2 días) o una fecha final de temporada?
8. ~~Adornos terminados online~~ — **Resuelto (2026-11-04):** online solo personalizados. Pendiente relacionado: los colores verde y blanco no tienen stock creado; ¿se venden online o solo rojo y gris?
9. **Notificaciones.** No hay aviso cuando entra un pedido web (lo dejaste para después). ¿Email, Telegram o WhatsApp? ¿Y email de confirmación al cliente? (Stripe puede enviar el recibo si lo activas en su panel.)
10. **Stripe.** Mencionaste un plugin de Stripe: no lo encontré en esta sesión. Para activarlo hace falta: cuenta Stripe, `STRIPE_SECRET_KEY` (empieza por `sk_test_` en pruebas), crear el webhook a `https://<tu-api>/api/shop/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`, copiar su `STRIPE_WEBHOOK_SECRET`, y poner `SHOP_ENABLED=true` y `PUBLIC_BASE_URL`. Pásame el plugin o las claves de test y lo pruebo de punta a punta.
11. **Textos legales.** Para vender online en Austria hacen falta AGB, Datenschutzerklärung (DSGVO, hay fotos de mascotas y direcciones) e Impressum. ¿Los tienes? ¿Cuánto tiempo guardamos fotos y direcciones?
12. **Cambios después de pagar.** No hay cancelación ni reembolso en la app; se haría a mano en Stripe. ¿Suficiente para este año?

## Seguridad y despliegue

13. **Código de pedido.** `AWG` + 4 dígitos (9.000 combinaciones) se puede adivinar. Track muestra solo el nombre de pila, la mascota y los importes, y la dirección ya está protegida con el token largo, pero recomiendo pasar a 6 dígitos o letras. ¿Lo cambio? (Los docs fijaban 4.)
14. **Despliegue.** ¿Dónde lo vas a alojar? Necesito saber el dominio para CORS, `PUBLIC_BASE_URL` y HTTPS. Las fotos van a disco (`UPLOADS_DIR`), así que el servidor necesita un volumen persistente.
15. **Base de datos.** Ahora Hibernate crea y actualiza las tablas (`ddl-auto=update`). Antes de producción conviene usar migraciones Flyway. ¿Las preparo?
16. **Contraseñas del staff.** En producción se crean desde `STAFF_GABY_PASSWORD` y `STAFF_ANDRES_PASSWORD`, y no hay pantalla para cambiarlas. ¿Quieres esa pantalla?
17. **`package-lock.json` en la raíz.** Está sin seguimiento y no pertenece a ningún paquete. ¿Lo borro?
