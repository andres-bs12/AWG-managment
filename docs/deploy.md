# Despliegue con Docker Compose

Este despliegue ejecuta PostgreSQL, el backend y el frontend. El frontend queda disponible en el puerto 8081 del servidor; nginx entrega la aplicación y reenvía `/api/` al backend. Solo PostgreSQL y los archivos subidos usan volúmenes persistentes.

## Producción actual (2026-11-06)

- **Servidor:** AWS EC2 `awg-prod`, t4g.small (ARM, 2 GB + 2 GB de swap), Ubuntu 24.04, región **eu-north-1 (Estocolmo)**: la cuenta está en el plan gratis (100 USD de créditos hasta 2027-05-06) y ese plan bloquea Frankfurt. IP fija 13.62.252.19. Código en `/opt/awg`, `.env` con permisos 600 y contraseñas generadas en el propio servidor.
- **Firewall (security group `awg-web`):** solo 443 desde los rangos IPv4 de Cloudflare y 22 desde la IP del dueño (actualízala si cambia). El puerto 80 está cerrado: Cloudflare redirige a HTTPS ("Always Use HTTPS").
- **HTTPS:** Cloudflare en modo Full (strict). Caddy usa un certificado de origen de Cloudflare válido hasta 2041 (`/etc/caddy/origin/`); la llave privada se generó en el servidor y nunca salió de él (solo se envió la CSR). Caddy redirige `www` al dominio principal y añade HSTS en ambos.
- **Secretos:** `ssh -t -i ~/.ssh/awg-tracking ubuntu@13.62.252.19 'awg-secret STRIPE_SECRET_KEY'` pide el valor sin mostrarlo, lo guarda en `.env` y reinicia. Sirve para `STRIPE_*`, `MAIL_*`, `OWNER_EMAIL` y `SHOP_ENABLED`.
- **Stripe (modo prueba):** destino de webhook `awg-production` → `/api/shop/stripe/webhook` con `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`.
- **Respaldos:** política de Data Lifecycle Manager con snapshot diario del disco (02:30 UTC) y 7 copias.
- **Desplegar una versión nueva:** `deploy/deploy.sh` compila las imágenes en el Mac (arm64), las sube por SSH y reinicia; el servidor no compila nada.
- **Contraseñas iniciales del staff:** después de cambiarlas en la app, deja `STAFF_GABY_PASSWORD` y `STAFF_ANDRES_PASSWORD` vacías en `/opt/awg/.env` y vuelve a desplegar (Codex P2-6).
- **Estado:** `deploy/status.sh` (web, créditos, memoria, disco, contenedores, errores y caducidad del certificado).

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
| `SHOP_DELIVERIES_FROM` | Primer día con entregas web (por defecto `2026-11-30`, después del primer fin de semana de mercado). |
| `DELIVERY_WINDOW_START` / `DELIVERY_WINDOW_END` | Franja fija de entrega en Viena, `HH:mm` en Europe/Vienna; `18:00` / `20:00` por defecto. |
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

## HTTPS y Stripe

Configura un proxy inverso o servicio de hosting con certificado TLS para dirigir el tráfico HTTPS del dominio al puerto 8081 del servidor. El puerto 8081 solo escucha en `127.0.0.1` (`docker-compose.yml`), así que el proxy TLS debe correr en el mismo servidor; si el proxy es un contenedor, quita la publicación del puerto y conéctalo por una red privada de Docker. Configura los límites de carga del proxy externo para permitir solicitudes de hasta 60 MB. El servidor nginx incluido no termina TLS.

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

El esquema lo gestiona Flyway (`awg-tracking/src/main/resources/db/migration`): al arrancar aplica las migraciones pendientes y Hibernate solo valida (`ddl-auto=validate`). Cualquier cambio de esquema va en un archivo nuevo `V<n>__descripcion.sql`; nunca edites uno ya aplicado.

## E-mails (notificaciones)

Cada movimiento de un pedido manda un e-mail al dueño y al cliente:
- Al dueño: pedido web pagado, venta en el puesto, cambio de pago, todo pintado, entregado, cancelado, cambio de dirección y formulario enviado.
- Al cliente, en alemán e inglés: los mismos movimientos excepto el formulario enviado.

Variables:

| Variable | Uso |
|---|---|
| `MAIL_HOST`, `MAIL_PORT` | Servidor SMTP (por ejemplo, el de tu proveedor de correo; puerto 587 con STARTTLS). Vacío = no se envía nada (solo queda en el log). |
| `MAIL_USERNAME`, `MAIL_PASSWORD` | Credenciales SMTP (contraseña de aplicación si el proveedor la pide). |
| `MAIL_FROM` | Remitente, por ejemplo `pedidos@<tu-dominio>`. |
| `OWNER_EMAIL` | A dónde llegan los avisos del dueño. |

Los e-mails se envían en segundo plano después de guardar el cambio. Si el SMTP falla, el pedido no se ve afectado y el error queda en el log.

## Retención de datos

Cada noche (03:30, hora de Viena) el backend borra las fotos y los datos personales (nombre, e-mail, teléfono, dirección, nombre de la mascota, nota) de los pedidos entregados hace más de 60 días. Los pedidos que nunca se entregaron se borran al cumplir un año. Se conservan el código, las fechas, los adornos y los importes para la contabilidad. El enlace del formulario deja de funcionar 30 días después de la entrega. Las inscripciones a la lista de espera sin confirmar se borran a los 7 días. Los plazos se cambian con `RETENTION_FORM_LINK_DAYS`, `RETENTION_PERSONAL_DATA_DAYS`, `RETENTION_STALE_ORDER_DAYS` y `RETENTION_WAITLIST_UNCONFIRMED_DAYS`; confírmalos con tu asesor.

## IP del cliente y límites de intentos

En producción el tráfico pasa por Cloudflare, luego por Caddy en el servidor y luego por nginx. `frontend/nginx.conf` toma la IP del visitante de la cabecera `CF-Connecting-IP` cuando la petición llega desde la red de Docker (`set_real_ip_from 172.16.0.0/12`). Esto solo es seguro si el firewall del servidor (security group) acepta el puerto 443 únicamente desde los rangos de Cloudflare: si alguien llegara directo, podría inventar esa cabecera. Sin Cloudflare la cabecera no existe y nginx usa la dirección que ve. nginx reemplaza `X-Forwarded-For` (no lo concatena), y el backend con `FORWARD_HEADERS=native` confía solo en nginx.

## Copias de seguridad y datos personales

Las copias contienen datos de clientes, fotos, hashes de contraseñas y tokens. Guárdalas fuera del repositorio, en `~/awg-backups/` con permisos `chmod 700`, y cifradas si salen del servidor. Conserva como máximo 30 días de copias. Antes de reabrir una restauración, ejecuta la limpieza de retención para volver a borrar los datos que ya habían caducado.

## Facturas por correo (Task A, 2026-11-08)

Aplicar V8 al iniciar el backend (`ddl-auto=validate`). El contador transaccional y el archivo `invoice` viven en PostgreSQL: incluirlos siempre en backups/restauraciones, sin reiniciar el contador al cambiar de temporada. Cada actualización usa un número nuevo y referencia al documento anterior; nunca se renumeran los documentos existentes.

Los valores `INVOICE_*` y `DELIVERY_WINDOW_*` pasan al backend mediante Compose. Sustituir los placeholders fiscales con datos reales aprobados antes de usar estas facturas comercialmente; la aplicación no determina el régimen de IVA ni inventa un texto de exención. Ver la decisión y los límites en `contracts-and-dtos.md`.

Las facturas usan correo multipart con texto plano y HTML (sin PDF, sin dependencias nuevas). No se envía correo sin `MAIL_HOST`/`MAIL_FROM`; el documento queda pendiente. Tras configurar SMTP y reiniciar, se reintentan cada minuto, hasta 100 por pasada. Revisar errores SMTP en logs y `invoice.sent_at` para comprobar aceptación por el servidor de correo, que no garantiza recepción en la bandeja del cliente. Si el email se introduce después por QR, se asigna a los documentos pendientes de ese pedido. No hay endpoint público de facturas ni datos contables nuevos en Track.

Las facturas conservan su propia copia contable aunque se borren/anonicen los datos operativos. La política definitiva de conservación y el contenido fiscal deben validarse con el asesor; no se aplica a las facturas el borrado operativo de 60 días. Una caída entre la aceptación SMTP y el commit de `sent_at` puede requerir revisión manual para evitar reenviar el mismo documento; SMTP no ofrece entrega exactamente una vez.
