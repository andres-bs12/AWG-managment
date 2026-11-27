# Despliegue con Docker Compose

Este despliegue ejecuta PostgreSQL, el backend y el frontend. El frontend queda disponible en el puerto 8081 del servidor; nginx entrega la aplicación y reenvía `/api/` al backend. Solo PostgreSQL y los archivos subidos usan volúmenes persistentes.

## Producción actual

v3.1.0 desplegada el **2026-11-20**. La etiqueta `v3.1.0` y `origin/main` apuntan a `389a1b3`. `release/v3.1` añade el registro documental `f455a37`. Flyway **V1–V17** en producción, con V14–V17 aplicadas en este despliegue. Backup previo en el servidor: `~/backups/pre-v3.1-20261120T2038.sql.gz`.

- **Servidor:** AWS EC2 `awg-prod`, t4g.small (ARM, 2 GB + 2 GB de swap), Ubuntu 24.04, región **eu-north-1 (Estocolmo)**: la cuenta está en el plan gratis (100 USD de créditos hasta 2027-05-06) y ese plan bloquea Frankfurt. IP fija 13.62.252.19. Código en `/opt/awg`, `.env` con permisos 600 y contraseñas generadas en el propio servidor.
- **Firewall (security group `awg-web`):** solo 443 desde los rangos IPv4 de Cloudflare y 22 desde la IP del dueño. Si cambia, el dueño ejecuta `aws login` y Claude actualiza con AWS CLI la regla de entrada del puerto 22 en `awg-web`, región `eu-north-1`, al nuevo IPv4 del dueño (/32). El puerto 80 está cerrado: Cloudflare redirige a HTTPS ("Always Use HTTPS").
- **HTTPS:** Cloudflare en modo Full (strict). Caddy usa un certificado de origen de Cloudflare válido hasta 2041 (`/etc/caddy/origin/`); la llave privada se generó en el servidor y nunca salió de él (solo se envió la CSR). Caddy redirige `www` al dominio principal y añade HSTS en ambos.
- **Secretos:** `ssh -t -i ~/.ssh/awg-tracking ubuntu@13.62.252.19 'awg-secret STRIPE_SECRET_KEY'` pide el valor sin mostrarlo, lo guarda en `.env` y reinicia. Sirve para `STRIPE_*`, `MAIL_*`, `OWNER_EMAIL` y `SHOP_ENABLED`.
- **Stripe:** destino de webhook documentado para modo de pruebas `awg-production` → `/api/shop/stripe/webhook` con `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`.
- **Respaldos:** política de Data Lifecycle Manager con snapshot diario del disco (02:30 UTC) y 7 copias.
- **Desplegar una versión nueva:** `deploy/deploy.sh` compila las imágenes en el Mac (arm64), las sube por SSH y reinicia; el servidor solo carga las imágenes. Requiere árbol limpio y un `e2e-full` verde para el commit exacto (el script comprueba cambios rastreados y el resultado del workflow manual). Ejecuta `gh workflow run CI --ref release/vX.Y` y vigila el resultado con `scripts/ci-wait.sh`. Haz el backup antes de desplegar y comprueba estado y correo después.
- **Contraseñas iniciales del staff:** después de cambiarlas en la app, deja `STAFF_GABY_PASSWORD` y `STAFF_ANDRES_PASSWORD` vacías en `/opt/awg/.env` y vuelve a desplegar (Codex P2-6).
- **Estado:** `deploy/status.sh` (web, créditos, memoria, disco, contenedores, errores y caducidad del certificado).

## Restablecer contraseña de staff

El dueño ejecuta `deploy/reset-staff-password.sh <email>` desde el checkout que contiene el script. Pide la contraseña dos veces sin mostrarla (mín. 10 caracteres, máx. 72 bytes), calcula bcrypt localmente con `htpasswd` y envía solo el hash de la contraseña al servidor por SSH. Actualiza la cuenta indicada y cierra sus sesiones abiertas. `AWG_HOST` y `AWG_KEY` permiten elegir destino y llave. El script está disponible como archivo local de operaciones en este checkout.

## Configuración y arranque

1. Instala Docker y Docker Compose en el servidor.
2. Copia `.env.deploy.example` a `.env` en la raíz del repositorio y reemplaza los valores de ejemplo por los del entorno. Mantén `.env` fuera del control de versiones y restringe su acceso.
3. Configura el dominio y HTTPS como se indica abajo. Desde la raíz ejecuta:

```bash
docker compose --env-file .env up -d --build
```

Consulta el estado con `docker compose --env-file .env ps` y los registros con `docker compose --env-file .env logs -f`. El frontend puede arrancar antes de que el backend esté listo; espera a que termine de iniciar antes de probarlo.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `POSTGRES_DB` | Nombre de la base que crea PostgreSQL y a la que se conecta el backend. |
| `DB_USERNAME` | Usuario de PostgreSQL, compartido por la base y el backend. |
| `DB_PASSWORD` | Contraseña del usuario de PostgreSQL. |
| `STAFF_GABY_PASSWORD` | Contraseña inicial para crear la cuenta de Gaby. |
| `STAFF_ANDRES_PASSWORD` | Contraseña inicial para crear la cuenta de Andres. |
| `SHOP_ENABLED` | `false` desactiva la tienda; usa `true` solo cuando Stripe y el dominio estén configurados. |
| `SHOP_DELIVERIES_FROM` | Primer día de recogida web en mercado (vacío por defecto = desde mañana; antes `2026-11-30`, el dueño abrió la recogida web el 2026-11-27). Si el `.env` del servidor aún dice `2026-11-30`, vaciarlo. |
| `SHOP_PRIMARY_PICKUP_MARKET_ID` | `awg.shop.primary-pickup-market-id`. UUID del mercado primario para recogida web en fechas solapadas y respaldo para el puesto efectivo de pintura. Vacío por defecto. |
| `SHIPPING_FEE` | `awg.pricing.shipping`. 5,00 € por pedido por defecto. Stock puede sustituirlo. |
| `POST_COLLECTION_WEEKDAYS` | `awg.post.collection-weekdays`. `TUESDAY,FRIDAY` por defecto. Stock puede sustituirlo. Los festivos se desplazan al siguiente día laborable. |
| `POST_TRANSIT_MIN_DAYS` / `POST_TRANSIT_MAX_DAYS` | `awg.post.transit-min-days` / `transit-max-days`. Rango de llegada en días laborables (2–3 por defecto). |
| `POST_LAST_ARRIVAL` | `awg.post.last-arrival`. Si está vacío, un día antes de `SHOP_SEASON_END` (23 de diciembre de 2026 con el valor de temporada por defecto). |
| `POST_PAINT_FROM` | `awg.post.paint-from`. Primer día de pintura para Post web y mínimo para calcular cuándo está listo un paquete. Por defecto `2026-11-25`. |
| `POST_COLLECTION_FROM` | `awg.post.collection-from`. Primera fecha admitida para recogida de Correos, sin mínimo adicional por defecto. |
| `POST_FINISHED_WITH_CUSTOM` | `awg.post.finished-with-custom`. `true` permite enviar acabados junto a un personalizado por Post del mismo pedido. `false` permite enviar solo personalizados. |
| `DELIVERY_WINDOW_START` / `DELIVERY_WINDOW_END` | Franja de pedidos históricos de entrega en Viena, `HH:mm` en Europe/Vienna; `18:00` / `20:00` por defecto. |
| `INVOICE_BUSINESS_NAME` | Nombre fiscal del vendedor (`awg.invoice.business-name`); por defecto `[Firmenname]`. |
| `INVOICE_ADDRESS` | Domicilio fiscal completo (`awg.invoice.address`); por defecto `[Firmenadresse]`. |
| `INVOICE_UID` | UID, si corresponde; vacío por defecto (la línea no aparece en la factura). Mientras nombre, dirección o nota fiscal sigan vacíos o con `[placeholder]`, no se emite ninguna factura. |
| `INVOICE_TAX_NOTE` | Texto fiscal aprobado por el asesor; placeholder explícito por defecto. No se presume una exención de IVA. |
| `INVOICE_IBAN` | IBAN opcional; vacío por defecto, no se muestra si no existe. |
| `SHOP_SEASON_END` | Último día de entrega de la temporada (por defecto `2026-12-24`); después la tienda muestra la lista de espera. |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe correspondiente al entorno de pruebas o producción. |
| `STRIPE_WEBHOOK_SECRET` | Secreto de firma del endpoint de webhook de Stripe. |
| `PUBLIC_BASE_URL` | Origen público del frontend, por ejemplo `https://example.com`, usado para volver desde Stripe. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas; incluye el origen HTTPS público. |

Compose construye `DB_URL` como `jdbc:postgresql://postgres:5432/<POSTGRES_DB>` y fija `UPLOADS_DIR=/data/uploads`; no es necesario incluirlas en `.env`. Los usuarios y la base de PostgreSQL se inicializan al crear el volumen por primera vez: cambiar las variables después no actualiza automáticamente sus credenciales. Las contraseñas de staff se usan para crear las cuentas al iniciar; cambiarlas en `.env` no implica que se actualicen cuentas existentes.

El Compose base no pasa `SHOP_PRIMARY_PICKUP_MARKET_ID`, `SHIPPING_FEE` ni `POST_*` al backend. Para sustituir esos valores de Spring, pásalos de forma explícita en el entorno del servicio `backend` mediante la configuración de Compose de ese entorno. Añadirlos solo a `.env` no basta. El despliegue vuelve a generar `/opt/awg/docker-compose.yml` desde el Compose del repo, así que conserva la configuración adicional fuera del archivo generado.

## HTTPS y Stripe

Configura un proxy inverso o servicio de hosting con certificado TLS para dirigir el tráfico HTTPS del dominio al puerto 8081 del servidor. El puerto 8081 solo escucha en `127.0.0.1` (`docker-compose.yml`), así que el proxy TLS debe correr en el mismo servidor; si el proxy es un contenedor, quita la publicación del puerto y conéctalo por una red privada de Docker. Configura los límites de carga del proxy externo para permitir solicitudes de hasta 64 MB. El servidor nginx incluido no termina TLS.

El proxy externo debe redirigir HTTP a HTTPS y añadir `Strict-Transport-Security: max-age=31536000` a todas las respuestas HTTPS, incluidos errores. Verifica la cabecera en el dominio público: nginx no puede garantizar HSTS porque recibe HTTP interno. Añade `includeSubDomains` solo si todos los subdominios usan HTTPS. El HTML también declara `no-referrer` para proteger los enlaces del formulario en hosts sin las cabeceras de nginx.

En Stripe, crea un endpoint de webhook para `https://<dominio>/api/shop/stripe/webhook` y selecciona estos eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`

Copia el secreto de firma a `STRIPE_WEBHOOK_SECRET`, configura la clave en `STRIPE_SECRET_KEY` y verifica el flujo completo en modo de pruebas antes de activar la tienda. Usa claves y webhook del mismo entorno de Stripe. Tras cambiar `.env`, vuelve a ejecutar el comando de arranque para recrear los servicios con la configuración nueva.

## Copias de seguridad

Guarda las copias fuera del servidor y verifica periódicamente que puedas restaurarlas. Para un volcado lógico de PostgreSQL, ejecuta desde la raíz:

```bash
docker compose --env-file .env exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > ~/awg-backups/awg-postgres-$(date +%F).dump
```

Para respaldar las fotos, identifica el nombre real del volumen y crea un archivo comprimido en el directorio actual:

```bash
docker compose --env-file .env config --volumes
docker volume ls
# Reemplaza NOMBRE_DEL_VOLUMEN por el volumen del proyecto que termina en uploads_data.
docker run --rm -v NOMBRE_DEL_VOLUMEN:/data:ro -v ~/awg-backups:/backup alpine:3.21 tar czf /backup/awg-uploads-$(date +%F).tar.gz -C /data .
```

Coordina las copias de la base y las fotos para que representen el mismo momento; detener temporalmente las escrituras durante ambas evita que queden desincronizadas. No uses `docker compose down -v` salvo que quieras eliminar los datos persistentes.

El esquema lo gestiona Flyway (V1–V17 en `awg-tracking/src/main/resources/db/migration`): al arrancar aplica las migraciones pendientes y Hibernate solo valida (`ddl-auto=validate`). Cualquier cambio de esquema va en un archivo nuevo `V<n>__descripcion.sql`; nunca edites uno ya aplicado.

## E-mails (notificaciones)

Con SMTP configurado, el dueño recibe avisos de venta, pago, producción, entrega o envío, cancelación y ediciones del cliente, en texto plano. El cliente recibe como máximo un correo HTML por evento, en el idioma que eligió (plantillas aprobadas el 2026-11-22 en `service/mail/CustomerMailTemplates`): pedido confirmado (formulario QR completado, venta con email o pago web), pago recibido, Kugel lista para recoger (no en envíos por Post), en camino por Post, entregada con el comprobante final, dirección cambiada, pedido cancelado y la confirmación de la lista de espera. Todos llevan Instagram y el email de contacto. Sin datos fiscales no se envía un comprobante aparte: el correo del evento ya incluye la confirmación de pago. El correo «unterwegs» sale en alemán al completar la entrega a Correos e incluye el rango de llegada y el enlace de seguimiento si hay número.

Variables:

| Variable | Uso |
|---|---|
| `MAIL_HOST`, `MAIL_PORT` | Servidor SMTP (por ejemplo, el de tu proveedor de correo; puerto 587 con STARTTLS). Vacío = no se envía nada (solo queda en el log). |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | Credenciales SMTP (contraseña de aplicación si el proveedor la pide). |
| `MAIL_FROM` | Remitente, por ejemplo `pedidos@<tu-dominio>`. |
| `OWNER_EMAIL` | A dónde llegan los avisos del dueño. Admite varias direcciones separadas por comas. |
| `MAIL_REPLY_TO` | Opcional. A dónde llegan las respuestas de los clientes (por ejemplo, el buzón de Gaby). |
| `MAIL_CONTACT` | Email de contacto que aparece al pie de cada correo al cliente, junto a Instagram. Por defecto `artwithgab@gmail.com`. |

Los e-mails se envían en segundo plano después de guardar el cambio. Si el SMTP falla, el pedido no se ve afectado y el error queda en el log.

## Retención de datos

Cada noche (03:30, hora de Viena) el backend borra las fotos y los datos personales (nombre, e-mail, teléfono, dirección, nombre de la mascota, nota) de los pedidos entregados hace más de 60 días. También borra el número de seguimiento de Correos. Los pedidos que nunca se entregaron se borran al cumplir un año. Se conservan el código, las fechas, los adornos y los importes para la contabilidad. El enlace del formulario deja de funcionar 30 días después de la entrega. Las inscripciones a la lista de espera sin confirmar se borran a los 7 días. Los plazos se cambian con `RETENTION_FORM_LINK_DAYS`, `RETENTION_PERSONAL_DATA_DAYS`, `RETENTION_STALE_ORDER_DAYS` y `RETENTION_WAITLIST_UNCONFIRMED_DAYS`; confírmalos con tu asesor.

## IP del cliente y límites de intentos

En producción el tráfico pasa por Cloudflare, luego por Caddy en el servidor y luego por nginx. `frontend/nginx.conf` toma la IP del visitante de la cabecera `CF-Connecting-IP` cuando la petición llega desde la red de Docker (`set_real_ip_from 172.16.0.0/12`). Esto solo es seguro si el firewall del servidor (security group) acepta el puerto 443 únicamente desde los rangos de Cloudflare: si alguien llegara directo, podría inventar esa cabecera. Sin Cloudflare la cabecera no existe y nginx usa la dirección que ve. nginx reemplaza `X-Forwarded-For` (no lo concatena), y el backend con `FORWARD_HEADERS=native` confía solo en nginx.

## Copias de seguridad y datos personales

Las copias contienen datos de clientes, fotos, hashes de contraseñas y tokens. Guárdalas fuera del repositorio, en `~/awg-backups/` con permisos `chmod 700`, y cifradas si salen del servidor. Conserva como máximo 30 días de copias. Antes de reabrir una restauración, ejecuta la limpieza de retención para volver a borrar los datos que ya habían caducado.

## Facturas por correo (Task A, 2026-11-08)

Flyway V12 creó esta tabla y ya está aplicada en producción (`ddl-auto=validate`). El contador transaccional y el archivo `invoice` viven en PostgreSQL: incluirlos siempre en backups/restauraciones, sin reiniciar el contador al cambiar de temporada. Cada actualización usa un número nuevo y referencia al documento anterior; nunca se renumeran los documentos existentes.

Los valores `INVOICE_*` pasan al backend mediante Compose. `DELIVERY_WINDOW_*` conserva la franja para entregas antiguas de Viena. Sustituir los placeholders fiscales con datos reales aprobados antes de usar estas facturas comercialmente; la aplicación no determina el régimen de IVA ni inventa un texto de exención. Ver la decisión y los límites en `contracts-and-dtos.md`.

Las facturas usan correo multipart con texto plano y HTML (sin PDF, sin dependencias nuevas). No se envía correo sin `MAIL_HOST`/`MAIL_FROM`; el documento queda pendiente. Tras configurar SMTP y reiniciar, se reintentan cada minuto, hasta 100 por pasada. Revisar errores SMTP en logs y `invoice.sent_at` para comprobar aceptación por el servidor de correo, que no garantiza recepción en la bandeja del cliente. Si el email se introduce después por QR, se asigna a los documentos pendientes de ese pedido. No hay endpoint público de facturas ni datos contables nuevos en Track.

Las facturas conservan su propia copia contable aunque se borren/anonicen los datos operativos. La política definitiva de conservación y el contenido fiscal deben validarse con el asesor; no se aplica a las facturas el borrado operativo de 60 días. Una caída entre la aceptación SMTP y el commit de `sent_at` puede requerir revisión manual para evitar reenviar el mismo documento; SMTP no ofrece entrega exactamente una vez.

## Controles de seguridad en producción

- nginx defaults to a **64 KiB request body**; `/api/shop/checkout` and `/api/forms/` allow **64 MiB** for multipart requests, and the numbered-stock photo route allows **6 MiB** (5 MiB JPEG limit in the application). `/api/photos/{id}` is download-only. Preserve the same proxy headers and token-log exclusions on the upload locations. The webhook remains under the 64 KiB proxy limit; its separate application limit is 256 KiB, including requests without Content-Length.
- The frontend image uses `nginx:1.27-alpine`. The backend JVM reserves at most 70% of container memory for its heap and exits on OutOfMemoryError. Keep container memory limits set and restart policies enabled.
- IPv6 limiter keys share a `/64`; IPv4-mapped IPv6 uses the equivalent IPv4 key. Track allows at most 300 missing-order responses per hour across clients, then returns 429 `RATE_LIMITED` before looking up any code until the window expires. This deliberately suspends Track for all clients during that interval; otherwise valid/invalid responses would still allow enumeration. Failed logins are limited by account **and** client; 200 account-wide failures per minute produce one warning and do not block other clients.
- Waitlist confirmation mail (new sign-ups **and resends**) is limited to 3/client/hour, 30 globally/hour and 200 globally/day. Confirmed addresses and repeats inside the address cooldown consume no mail budget. Exhausted budgets are checked before address lookup, so all addresses receive the same throttled response. Address/form edit notifications share one leading mail event per order per 15 minutes, so intermediate edits do not send more mail. Unconfirmed web orders cannot edit forms/addresses and never receive customer notification mail.
- These in-memory rate and mail budgets apply to the current **single backend instance**, reset on process restart and use fixed windows. Introduce a shared store before running multiple backend replicas; this is separate from the database-backed checkout caps already present in V10.
- **V13__metrics_lock.sql** reserves coordination row 2 for metrics, leaving row 1 for painting/stock scheduling. Keep all applied migrations V1–V17 unchanged.
- SMTP warnings contain only the exception class and numeric SMTP status (0 if unavailable), without recipients, exception text or stack traces. Consult the mail provider's restricted delivery dashboard for deeper diagnostics.

### Manual owner step: Cloudflare abuse protection

Following the [Cloudflare rate-limiting rule documentation](https://developers.cloudflare.com/waf/rate-limiting-rules/), create and enable a WAF rate-limiting rule for `GET` requests where `http.request.uri.path` starts with `/api/track/`. Start with **30 requests per client IP per minute**, blocking excess requests with 429 for one minute; use the closest supported period/threshold if the account plan differs. Use Cloudflare's IPv6 /64 grouping where available. Keep the application's /64 and global missing-order budgets active because an IP-only edge rule cannot stop a client rotating IPv6 addresses.

This edge rule must be configured by the owner in the Cloudflare dashboard; it was **not applied by this code change**. Do not challenge or rate-limit Stripe's webhook with this Track rule. Verify a normal Track lookup, an excess-request 429, and real client IP forwarding after deployment. Keep origin ingress restricted to Cloudflare ranges as described above.

## Claude connector (MCP), 2026-11-22

- `.env`: `MCP_ENABLED=true` turns it on, and `MCP_ALLOWED_EMAILS=andres@artwithgab.com,gaby@artwithgab.com` says who may connect (each person from their own Claude account and staff login; every connector session is bound to its own staff user) (empty = nobody, not even with a right password). `MCP_PUBLIC_URL` defaults to `https://artwithgab.com` in `docker-compose.yml`. `MCP_REDIRECT_URIS` is optional; it defaults to the claude.ai and claude.com callbacks.
- Flyway applies **V19__session_audience.sql**, which needs V18 first. It adds `staff_session.audience` with a default, so existing sessions keep working.
- `frontend/nginx.conf` sends `/mcp`, `/oauth/*` and `/.well-known/oauth-*` to the backend without the site CSP, because the sign-in page has to redirect to claude.ai. Caddy needs no change, since it proxies every path to nginx.
- Cloudflare: claude.ai calls `/mcp` from Anthropic's servers. If Bot Fight Mode or a WAF rule challenges those requests, the connector fails, so add a skip rule for `/mcp` and `/oauth/` when that happens. Do not cache these paths.
- Check after the deploy: run `scripts/mcp-smoke.sh`, which needs no password and makes 10 checks. `curl -si -X POST https://artwithgab.com/mcp` must return 401 with `WWW-Authenticate: Bearer resource_metadata=…`. Then add the connector in claude.ai (Settings → Connectors → custom → `https://artwithgab.com/mcp`) and sign in with a staff account.
- Owner's quick guide (Spanish, market day): `docs/conector-claude.md`.
- **Before any rollback to a build without V19**, revoke connector sessions: `sudo docker compose exec postgres psql -U "$DB_USERNAME" -d "$POSTGRES_DB" -c "DELETE FROM staff_session WHERE audience = 'mcp';"`. Connector tokens are hashed as SHA-256("mcp:" + token), so an old build would not find them anyway; deleting them makes that certain.
