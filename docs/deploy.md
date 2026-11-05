# Despliegue con Docker Compose

Este despliegue ejecuta PostgreSQL, el backend y el frontend. El frontend queda disponible en el puerto 8081 del servidor; nginx entrega la aplicación y reenvía `/api/` al backend. Solo PostgreSQL y los archivos subidos usan volúmenes persistentes.

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
| `SHOP_SEASON_END` | Último día de entrega de la temporada (por defecto `2026-12-24`); después la tienda muestra la lista de espera. |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe correspondiente al entorno de pruebas o producción. |
| `STRIPE_WEBHOOK_SECRET` | Secreto de firma del endpoint de webhook de Stripe. |
| `PUBLIC_BASE_URL` | Origen público del frontend, por ejemplo `https://example.com`, usado para volver desde Stripe. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por comas; incluye el origen HTTPS público. |

Compose construye `DB_URL` como `jdbc:postgresql://postgres:5432/<POSTGRES_DB>` y fija `UPLOADS_DIR=/data/uploads`; no es necesario incluirlas en `.env`. Los usuarios y la base de PostgreSQL se inicializan al crear el volumen por primera vez: cambiar las variables después no actualiza automáticamente sus credenciales. Las contraseñas de staff se usan para crear las cuentas al iniciar; cambiarlas en `.env` no implica que se actualicen cuentas existentes.

## HTTPS y Stripe

Configura un proxy inverso o servicio de hosting con certificado TLS para dirigir el tráfico HTTPS del dominio al puerto 8081 del servidor. El puerto 8081 solo escucha en `127.0.0.1` (`docker-compose.yml`), así que el proxy TLS debe correr en el mismo servidor; si el proxy es un contenedor, quita la publicación del puerto y conéctalo por una red privada de Docker. Configura los límites de carga del proxy externo para permitir solicitudes de hasta 60 MB. El servidor nginx incluido no termina TLS.

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

## Client IP and rate limits

nginx overwrites `X-Forwarded-For` with the address it sees, so clients cannot spoof it. When the stack runs behind another TLS proxy or load balancer, add `set_real_ip_from <proxy CIDR>;` and `real_ip_header X-Forwarded-For;` to `frontend/nginx.conf`. Without them, every visitor shares the proxy's address and therefore one rate-limit bucket. Keep `FORWARD_HEADERS=native` on the backend only when nginx is the sole entry point.

## Copias de seguridad y datos personales

Las copias contienen datos de clientes, fotos, hashes de contraseñas y tokens. Guárdalas fuera del repositorio, en `~/awg-backups/` con permisos `chmod 700`, y cifradas si salen del servidor. Conserva como máximo 30 días de copias. Antes de reabrir una restauración, ejecuta la limpieza de retención para volver a borrar los datos que ya habían caducado.
