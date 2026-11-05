# Preguntas pendientes para el dueño

Actualizado 2026-11-05 con tus respuestas. Abajo: lo que queda abierto y lo resuelto (para referencia).

## Abiertas

1. **Colores de los adornos.** Sin respuesta. Hoy se venden rojo y gris (los únicos con stock). Verde y blanco existen en el sistema, pero sin stock: si los quieres, créales stock y aparecen solos en la tienda. ¿Cuáles son los colores reales?
2. **Stripe.** Lo activas mañana. Tienes la guía en `docs/stripe-setup.md`. La CLI de Stripe ya está instalada; solo falta `stripe login` y tus claves de prueba.
3. **E-mail (SMTP).** Los avisos al dueño y al cliente ya están programados, pero no se envía nada hasta configurar `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` y `OWNER_EMAIL` (ver `docs/deploy.md`). ¿Qué proveedor de correo usas (Gmail/Workspace, Zoho, Brevo…)?
4. **Datos para los textos legales.** Los borradores de `/impressum`, `/agb` y `/datenschutz` tienen marcadores `[…]`: nombre o empresa, dirección, e-mail, teléfono, UID, GISA, proveedor de hosting y de e-mail. Necesitan esos datos y una revisión legal. (artwithgab.com no resolvía cuando lo consulté.)
5. **Despliegue.** Lo decides mañana. Todo está listo con Docker (`docs/deploy.md`); falta dominio y proveedor.
6. **Lista de espera.** Los e-mails se guardan (tabla `waitlist_entry`), pero no hay pantalla para verlos ni envío automático cuando abra la temporada 2027. ¿Lo hacemos más adelante?
7. **Avisos con agentes.** Comentaste que después quieres un seguimiento "más inteligente" de los movimientos. Queda para una fase futura.

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
- **Base de datos:** migraciones Flyway (V1 y V2).
- **Contraseñas del staff:** pantalla *Change password*.
- **`package-lock.json` de la raíz:** borrado (estaba vacío).
