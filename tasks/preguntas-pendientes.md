# Preguntas pendientes para el dueño

Actualizado 2026-11-05 con tus respuestas y con lo que encontró la auditoría final. Abajo: lo que queda abierto y lo resuelto (para referencia).

## Abiertas

1. **Stripe.** Lo activas hoy. Guía: `docs/stripe-setup.md` (falta `stripe login` y tus claves de prueba).
2. **Dominio y correo.** Los compras junto con el despliegue. Recomendación y pasos en `docs/siguiente-fase.md` (buzón en el registrador o Zoho Mail; envíos automáticos con Brevo, servidores en la UE).
3. **Despliegue.** Lo decides hoy. Todo está listo con Docker (`docs/deploy.md`); en `docs/siguiente-fase.md` hay una recomendación de servidor en la UE.
4. **Datos legales.** Todavía pendientes. Los borradores de `/impressum`, `/agb` y `/datenschutz` tienen marcadores `[…]`. El asesor debe revisar también: el botón "Zahlungspflichtig bestellen", que los adornos personalizados no se pueden devolver (§ 18 FAGG) y los plazos de borrado (60 días después de la entrega; las facturas, 7 años).
5. **Stock por acabado.** Supuse que las bases brillantes y mate son piezas distintas, así que el stock se lleva por color y acabado (6 filas). Si el acabado se aplica después sobre la misma base, avísame y lo cambio a stock solo por color.
6. **Textos de los acabados.** Puse "Glänzend: spiegelt das Licht, kräftige Farben. Matt: weich und samtig, ohne Spiegelungen." Revisa que describan bien tus adornos (idealmente con una foto de cada uno).
7. **Capacidad de pintura.** AGENTS.md dice lunes, martes y jueves 3 huecos (10–13) y miércoles y viernes 2 huecos (10–12). El servidor, en cambio, limita por defecto a 2 pinturas por día, cualquier día y también en días de puesto (`awg.painting.default-max-paintings=2`). ¿Qué regla vale? ¿Los días de puesto también permiten pintar?
8. **Cancelar pedidos pagados.** Hoy, cancelar borra el pedido por completo y no queda registro para la contabilidad. Propuesta: guardar el pedido como "cancelado" (con fecha y motivo) en lugar de borrarlo. ¿Te parece?
9. **Cambios después de la venta.** Hoy, cambiar el día de recogida, el color o quitar el nombre obliga a cancelar y vender de nuevo. ¿Quieres poder editar la venta? Si es así, ¿qué se puede cambiar?
10. **Entrega por adorno.** "Entregado" se marca por pedido. Un pedido con una Kugel recogida en el mercado y otra enviada a Viena no se puede marcar bien. ¿Lo pasamos a "entregado" por adorno?
11. **Recogida en el mercado (tienda web).** La implementé con hora de llegada cada 30 min, desde que abre el puesto hasta 30 min antes de cerrar, sin costo de envío y desde el primer día de mercado. Tu mensaje se cortó en "porque de pronto se puede…". ¿Hay un límite de recogidas por hora o alguna otra regla?

## Resueltas (2026-11-05, segunda ronda)

- **Colores:** rojo, verde y beige, cada uno brillante o mate, con un "?" que explica la diferencia. Gris y blanco dejan de venderse (se conservan en pedidos antiguos).
- **Primer día de entrega web:** después del primer mercado (último fin de semana de noviembre): desde el 30-nov-2026, es decir, el miércoles 2 de diciembre. Ajustable con `SHOP_DELIVERIES_FROM`. El 24-dic (jueves) sigue siendo el último día de entrega, como excepción.
- **Hora de entrega:** no hay hora fija; se avisa de que es por la tarde-noche.
- **Enlace del formulario:** deja de funcionar 30 días después de la entrega.
- **Track con códigos antiguos (decidido por mí):** con un código corto (anterior a `AWG` + 6) solo se ve el estado y la fecha; el nombre y los datos de la mascota solo se muestran con el enlace del formulario. Los códigos nuevos no cambian.
- **Borrado de datos:** fotos y datos personales se borran 60 días después de la entrega; se conserva lo contable (código, fechas, adornos, importes). Pedidos nunca entregados: al año.
- **Lista de espera:** confirmación por e-mail (doble opt-in) y enlace para darse de baja; las no confirmadas se borran a los 7 días. La pantalla para ver la lista y el envío automático quedan como tarea futura (`tasks/todo.md`).
- **Avisos con agentes:** para cuando todo esté en producción.

## Resueltas (2026-11-05)

- **Stock:** 3 bases por color y 10 terminados en una base nueva. Gaby lo ajusta en *Stock* (`/staff/inventory`). La base de desarrollo conserva sus números antiguos.
- **Días de pintura:** pinta todos los días. Por día hay un interruptor (abierto o cerrado) y un máximo (2 por defecto) en *Painting days*. Las sugerencias automáticas y la tienda respetan el límite; los movimientos manuales pueden superarlo.
- **Temporada:** se vende y se entrega hasta el 24 de diciembre (último día de entrega). Después, la tienda muestra "Santa ya salió" con la lista de espera.
- **Terminados:** flujo simple: se venden, se descuenta el stock y listo.
- **Depósito:** 50 % por defecto. El staff puede anotar otro importe si el cliente deja más.
- **Envío en Viena:** 0 €.
- **Antelación:** la pintura empieza en cuanto hay hueco (desde mañana), dentro de la semana previa a la entrega.
- **Solo personalizados online.**
- **Notificaciones:** e-mail al dueño y al cliente en cada movimiento (pendiente de SMTP, ver la pregunta 3).
- **Cancelaciones:** online, el cliente escribe un e-mail; en el puesto, lo cancelas tú en el detalle del pedido (*Cancel order*). Los reembolsos con tarjeta se hacen a mano en Stripe.
- **Código de pedido:** ahora `AWG` + 6 caracteres; los códigos antiguos siguen funcionando.
- **Base de datos:** migraciones Flyway (V1, V2 y V3).
- **Contraseñas del staff:** pantalla *Change password*.
- **`package-lock.json` de la raíz:** borrado (estaba vacío).

## Staff Task 11 — decisiones reservadas al dueño

Por instrucción expresa del dueño, no se implementan en Task 11:

- **P1-14:** edición de ítems después de vender (fecha, hora, color/acabado, añadir/retirar y nombre sin reembolso). Falta definir alcance y API bajo el lock de agenda.
- **P1-17:** entrega por ítem frente a entrega por pedido en pedidos mixtos. Se conserva el modelo por pedido; la lista agrupa las filas equivalentes y comprueba todos los adornos antes de entregar.
- **P1-18:** cancelación lógica, motivo y conservación contable. Se conserva el borrado actual con confirmación explícita de lo que se pierde y del dinero recibido. La corrección de Claude que evita reponer bases ya pintadas sí se mantiene y está reflejada en el mock.
- **P1-22:** capacidad por día de la semana y límite separado para el puesto. La UI muestra los límites que da el servidor y advierte sobre reservas manuales; no cambia los máximos acordados anteriormente sin una nueva decisión.

## 12. Pedidos web sin pagar que bloquean stock y horas (seguridad, 2026-11-05)

Al empezar el pago, la tienda reserva enseguida la bola y la hora de pintura. Hoy los límites son 5 intentos por minuto por IP y 15 pedidos pendientes en total. Alguien que no paga podría bloquear los colores que quedan durante el tiempo que dura la sesión de Stripe (30 minutos).

- **Opción A (recomendada):** limitar a 2 pedidos pendientes por e-mail y por dispositivo, y acortar la reserva a 15 minutos.
- **Opción B:** no reservar hasta que Stripe confirme el pago. Esto conlleva el riesgo de vender dos veces la última bola.

¿Cuál prefieres?

## 13. Facturas por e-mail (2026-11-08)

Respuestas del dueño (2026-11-08):
1. **Datos del vendedor:** no hay empresa registrada, así que hoy no se emiten facturas formales (el sistema no envía nada sin `awg.invoice.*`). Pendiente: decidir si se envía una confirmación de pago sencilla en lugar de una factura.
2. **Conservación de 7 años:** aprobada en principio. El negocio dura dos semanas y no espera superar el límite; conviene que lo confirme un asesor.
3. **Días de entrega:** miércoles y viernes, de 18 a 20 h (confirmado).

## 2026-11-12 · Endpoint de cambio de dirección sin uso

Track ya no permite cambiar la dirección de entrega (decisión del dueño, v3.1). El endpoint público `PATCH /api/track/{code}/address` (`PublicController` → `TrackingService.updateViennaAddress`) sigue en el backend sin que ningún frontend lo llame. Recomendación: borrarlo en la próxima versión para reducir superficie pública (la dirección se puede corregir desde el staff). Pendiente de tu OK.
