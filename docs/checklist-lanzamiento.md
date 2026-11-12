# Checklist de lanzamiento: dominio, e-mails, servidor y pagos

Para ArtWithGab, temporada 2026. Marca cada casilla al terminarla. Los precios son aproximados; confírmalos en la página de cada proveedor.

## Cómo queda armado

```
Cliente ──► Cloudflare (DNS, HTTPS, protección) ──► AWS EC2 (Caddy :443 ──► app en 127.0.0.1:8081)
                │
                └── Email Routing: hola@tudominio ──► tu Gmail (recibir)

App ──► Brevo SMTP (enviar avisos de pedidos)       App ◄──► Stripe (cobro web + webhook)
```

- **Cloudflare** se encarga del dominio, el DNS, el certificado público, el caché y la protección. Además recibe los e-mails y los reenvía.
- **AWS** solo corre el servidor.
- **Brevo** envía los e-mails de la app.
- **Stripe** cobra la tienda web.

Se integran sin problema: Cloudflare solo apunta el dominio a la IP de AWS.

## Fechas objetivo (hoy es 6-nov)

| Hasta | Qué |
|---|---|
| 10-nov | Dominio, Cloudflare y e-mail recibiendo |
| 14-nov | Servidor en AWS funcionando con Stripe en modo prueba |
| 18-nov | Textos legales listos y Stripe activado |
| 20-nov | Tienda en vivo, antes de empezar los anuncios de Facebook |
| 28-nov | Primer día de mercado |

## Costos aproximados

| Servicio | Costo |
|---|---|
| Dominio `.com` en Cloudflare | ~10–11 USD al año (precio de costo, sin margen) |
| Cloudflare (DNS, proxy, Email Routing) | Gratis |
| Brevo (300 e-mails al día) | Gratis |
| AWS EC2 + disco + IP | Cubierto por los créditos de cuenta nueva; sin créditos, ~20–40 USD al mes |
| Stripe | Comisión por venta (tarjetas europeas ~1,5 % + 0,25 €; ver stripe.com/at/pricing) |

---

## 1. Dominio (Cloudflare Registrar)

- [ ] Crea una cuenta en dash.cloudflare.com y activa **2FA**.
- [ ] Elige el nombre y búscalo en **Domain Registration → Register Domains**.
  - Cloudflare no vende todas las terminaciones. Hasta donde sé, **`.at` no está disponible**: verifícalo al buscar.
  - Si quieres `.at`, cómpralo en un registrador austriaco (por ejemplo World4You o easyname) y en el paso 2 cambia sus *nameservers* a los de Cloudflare.
  - Con `.com` todo queda en Cloudflare.
- [ ] Pon los datos del titular a tu nombre y activa la **privacidad WHOIS**. Activa también la **renovación automática**: si caduca en plena temporada, la tienda se cae.

## 2. Cloudflare: DNS y HTTPS

- [ ] Si compraste el dominio en Cloudflare, la zona ya existe. Si no, usa **Add a site** y cambia los nameservers en el otro registrador.
- [ ] **SSL/TLS → Overview:** modo **Full (strict)**.
- [ ] **SSL/TLS → Origin Server → Create Certificate:** certificado de origen de 15 años para `tudominio.com` y `*.tudominio.com`.
  - Guarda el certificado y la clave privada. La clave **solo se muestra una vez** y no debe ir al repositorio.
- [ ] **SSL/TLS → Edge Certificates:** activa **Always Use HTTPS** y **HSTS** (`max-age` de 12 meses, sin `includeSubDomains` al principio). Pon **Minimum TLS** en 1.2.
- [ ] **Caching → Cache Rules:** crea la regla «Bypass cache» para `/api/*` y `/form/*`.
- [ ] **Security → Bots:** deja **Bot Fight Mode desactivado**. Puede bloquear el webhook de Stripe, y en el plan gratis no se le puede hacer excepción.
- [ ] El registro DNS `A` que apunta al servidor se crea en el paso 4, cuando ya tengas la IP.

## 3. E-mails

Hay dos partes: **recibir** (que los clientes te escriban) y **enviar** (los avisos automáticos de la app).

### Recibir: Cloudflare Email Routing (gratis)

- [ ] **Email → Email Routing → Enable**. Cloudflare crea solo los registros MX y SPF.
- [ ] Crea direcciones de reenvío:
  - `hola@tudominio.com` → tu Gmail (contacto público, pantalla de cierre e Instagram);
  - `pedidos@tudominio.com` → tu Gmail (`OWNER_EMAIL`, donde te llegan los avisos de pedidos).
- [ ] Confirma el e-mail de verificación que llega a tu Gmail.

### Enviar desde la app: Brevo (gratis, SMTP)

La app envía por **SMTP**. Cloudflare tiene un servicio de envío, pero funciona por API o Workers, no por SMTP, así que usarlo obligaría a cambiar el código. Brevo funciona sin tocar nada.

- [ ] Crea una cuenta en brevo.com.
- [ ] En **Senders, Domains → Add domain**, agrega `tudominio.com`.
- [ ] En Cloudflare DNS crea los registros que te da Brevo (código de verificación, DKIM y DMARC) con **nube gris (DNS only)**.
- [ ] **SPF: un solo registro TXT `v=spf1`.** Si Brevo pide incluir el suyo, únelo al de Cloudflare en ese mismo registro. Ejemplo (ajústalo a lo que muestre Brevo):
  `v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all`
- [ ] DMARC inicial: TXT `_dmarc` con `v=DMARC1; p=none; rua=mailto:hola@tudominio.com`.
- [ ] En **SMTP & API → SMTP**, crea una clave SMTP. Los datos para `.env`:
  - `MAIL_HOST=smtp-relay.brevo.com`
  - `MAIL_PORT=587`
  - `MAIL_USERNAME` y `MAIL_PASSWORD`: el usuario y la clave que muestra Brevo
  - `MAIL_FROM=pedidos@tudominio.com`
  - `OWNER_EMAIL=pedidos@tudominio.com`, o tu Gmail directo
- [ ] Opcional: para **responder como `hola@tudominio.com` desde Gmail**, ve a Gmail → Configuración → Cuentas → «Enviar como» y usa el mismo SMTP de Brevo.

**Alternativa todo-AWS:** Amazon SES también tiene SMTP y es baratísimo.
- Arranca en *sandbox*: solo puede enviar a direcciones verificadas.
- Para enviar a cualquier cliente hay que pedir *production access*. Puede tardar un día o ser rechazado en cuentas nuevas.
- Para estas fechas, Brevo es más seguro.

## 4. Servidor en AWS

### Cuenta

- [ ] Crea la cuenta y pásala a **plan de pago**. Así no se cierra al terminar los créditos, que se siguen usando primero.
- [ ] Activa **MFA en el usuario root**. Crea un usuario IAM con Identity Center para el día a día y no uses root.
- [ ] En **Billing → Budgets**, crea un presupuesto de 10 USD con aviso al 50 % y al 100 %.
- [ ] Región: **eu-central-1 (Frankfurt)**.

### Máquina

- [ ] **EC2 → Launch instance**, con:
  - Ubuntu 24.04 LTS;
  - **t3.medium** (4 GB, cómodo para compilar con Docker), o **t3.small** más 2 GB de swap si quieres ahorrar;
  - disco gp3 de 30 GB;
  - un key pair nuevo, guardado en `~/.ssh` con `chmod 400`.
- [ ] **Security group**:
  - `22` (SSH): solo **tu IP**;
  - `443`: solo los **rangos IP de Cloudflare** (cloudflare.com/ips). Así nadie puede saltarse Cloudflare y llegar directo al servidor;
  - no abras `80`, `8080`, `8081` ni `5432`.
- [ ] **Elastic IP**: asígnala a la instancia. Cobra unos 3,6 USD al mes, que salen de los créditos.
- [ ] En Cloudflare DNS crea:
  - `A` `@` → Elastic IP, con **nube naranja (Proxied)**;
  - `CNAME` `www` → `tudominio.com`, también con nube naranja.

### Instalación

- [ ] Por SSH:
  - `sudo apt update && sudo apt upgrade`
  - instala Docker siguiendo la guía oficial (docs.docker.com/engine/install/ubuntu);
  - activa `unattended-upgrades`.
- [ ] Clona el repositorio. Como es privado, usa una **deploy key** de solo lectura de GitHub.
- [ ] Crea el `.env` desde `.env.deploy.example`:
  - contraseñas con `openssl rand -base64 24`;
  - `chmod 600 .env`;
  - `PUBLIC_BASE_URL=https://tudominio.com` y `CORS_ORIGINS=https://tudominio.com`;
  - `SHOP_ENABLED=false` hasta el paso 6.
- [ ] Ejecuta `docker compose --env-file .env up -d --build` y comprueba con `curl -s 127.0.0.1:8081/api/health`.

### Caddy (HTTPS en el servidor)

- [ ] Instala Caddy (caddyserver.com/docs/install, paquete de Ubuntu).
- [ ] Copia el certificado de origen a `/etc/caddy/origin.pem` y su clave a `/etc/caddy/origin.key`, con `chmod 600` y dueño `caddy`.
- [ ] Usa este `/etc/caddy/Caddyfile`:

```
tudominio.com, www.tudominio.com {
    tls /etc/caddy/origin.pem /etc/caddy/origin.key
    request_body {
        max_size 60MB
    }
    header Strict-Transport-Security "max-age=31536000"
    reverse_proxy 127.0.0.1:8081
}
```

- [ ] Ejecuta `sudo systemctl reload caddy`, abre `https://tudominio.com` y comprueba que carga con candado.

### Cambio pendiente en el código (lo hago yo)

- [ ] **IP real del cliente.** Detrás de Cloudflare y Caddy, la app ve a todos los visitantes con la misma IP, así que el límite de intentos los mezcla. Hay que cambiar `frontend/nginx.conf` para que use `CF-Connecting-IP`. Es seguro solo porque el security group acepta únicamente a Cloudflare.

### Respaldos

- [ ] **EC2 → Lifecycle Manager:** snapshot diario del disco, conservando 7. Es lo más fácil y cubre la base y las fotos.
- [ ] Opcional: `pg_dump` diario por cron, como en `docs/deploy.md`.

## 5. Primer arranque del staff

- [ ] Entra a `/staff` con Gaby y con Andrés y **cambia las contraseñas iniciales**.
- [ ] Carga los mercados y días reales, el stock por color y acabado y los días de pintura.
- [ ] Haz una venta de prueba en el puesto y una por QR con el iPad. Después cancélalas.
- [ ] Comprueba que llegan los e-mails de aviso. Usa mail-tester.com para ver que no caen en spam (objetivo: 9/10 o más).

## 6. Stripe

- [ ] Crea la cuenta en stripe.com como **persona individual** (Einzelunternehmer). Las dudas de Gewerbe e impuestos van con el asesor o la WKO.
- [ ] En **modo prueba**:
  - crea el webhook a `https://tudominio.com/api/shop/stripe/webhook` con los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded` y `checkout.session.expired`;
  - pon `STRIPE_SECRET_KEY` (sk_test) y `STRIPE_WEBHOOK_SECRET` en `.env`;
  - cambia a `SHOP_ENABLED=true` y vuelve a ejecutar `docker compose up -d`.
- [ ] Haz un pedido web con la tarjeta `4242 4242 4242 4242`. Debe aparecer pagado en el staff y llegarte el e-mail.
- [ ] Prueba también cancelar el pago en Stripe: el pedido no debe quedar colgado.
- [ ] Activa la cuenta (datos personales, IBAN, identidad) y repite el webhook en **modo live**.
- [ ] Cambia a las claves `sk_live` y `whsec_` live.
- [ ] Haz una compra real pequeña y reembólsala desde Stripe.

### Al desplegar la v1.1 (desplegada el 2026-11-07; quedan los pasos de Stripe)

- [x] La clave del servidor y el webhook deben ser de **la misma cuenta o sandbox** de Stripe. Antes estaban en sandboxes distintas: el servidor usaba `acct_1UUMa917…` y el webhook vivía en `acct_1UYmTi0…`. Ya están corregidas y ambas usan `acct_1UYmTi0…`. Para comprobarlo después de cada cambio de clave, ejecuta en el servidor `curl -u "$STRIPE_SECRET_KEY:" https://api.stripe.com/v1/account` dentro del contenedor backend: el `id` debe coincidir con la cuenta del webhook.
- [x] Despliega la v1.1 (2026-11-07, commit `21137b2`), que incluye el arreglo de Stripe: Stripe ya no acepta `payment_method_types`, y por eso todos los pagos web fallaban con 502.
- [ ] **Pospuesto por el dueño el 2026-11-07.** En Stripe, en **Settings → Payment methods** de esa cuenta, deja activas solo **tarjeta** y **Apple Pay / Google Pay**. El código ya no fija los métodos de pago. El webhook solo confirma una sesión si su `payment_status` es `paid`.
- [ ] **Pospuesto por el dueño el 2026-11-07.** Añade al webhook el evento `checkout.session.async_payment_failed`. El backend ya lo maneja.
- [ ] **Pospuesto por el dueño el 2026-11-07:** hasta hacerlo, el pago web completo no está verificado en producción. Repite la compra de prueba con `4242 4242 4242 4242`. El pedido debe salir pagado en el staff y deben llegar los dos e-mails. Si falla, el log del backend ya muestra el error exacto de Stripe (`Stripe checkout session failed: …`).
- [ ] Al pasar a modo **live** repite todo lo anterior con las claves live: una sola cuenta y un webhook live en esa misma cuenta.

## 7. Legal (lo deciden tú o tu asesor, no yo)

- [ ] **Impressum**, **AGB** (incluida la cláusula de personalizados y el «sin reembolso del nombre») y **Datenschutz**.
- [ ] El Datenschutz debe nombrar a los proveedores que tratan datos: **Cloudflare, AWS, Stripe y Brevo**.
- [ ] Contacto en la pantalla de cierre de temporada: pásame el e-mail o Instagram.

## 8. Antes de los anuncios

- [ ] `https://tudominio.com/buy` funciona en el celular, en alemán y en inglés.
- [ ] En securityheaders.com aparecen HSTS y las cabeceras de seguridad.
- [ ] `/track/CODIGO` funciona con un pedido real.
- [ ] Imprimiste el QR del puesto y lo probaste con 2 teléfonos distintos.
- [ ] Revisaste que la alerta de presupuesto de AWS llegue al e-mail correcto.

## 9. Al cerrar la temporada (enero)

- [ ] Después del 24-dic la tienda muestra sola la lista de espera.
- [ ] Haz un respaldo final cifrado y guárdalo fuera del servidor.
  - La app borra los datos personales 60 días después de cada entrega, pero solo si el servidor está encendido.
  - Si apagas antes, borra a mano los datos que ya hayan cumplido ese plazo.
- [ ] Al apagar en AWS:
  - **detén o termina la instancia**;
  - **libera la Elastic IP**, que se cobra aunque esté sin usar;
  - borra los snapshots viejos.
- [ ] Cloudflare y el dominio pueden quedarse: cuestan unos 10 USD al año y Email Routing sigue recibiendo.

---

## ¿Claude puede manejar Cloudflare?

Sí. Hay un **plugin oficial de Cloudflare** (publicado por Cloudflare) con su servidor MCP. Una vez instalado y con tu inicio de sesión, puedo:
- crear y revisar registros DNS;
- configurar SSL, HSTS y reglas de caché;
- configurar Email Routing.

Comprar el dominio, poner datos de pago y crear cuentas (Cloudflare, AWS, Stripe, Brevo) lo haces tú. Las claves y contraseñas tampoco me las pases por el chat: van directo al `.env` del servidor.
