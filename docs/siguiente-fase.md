# Siguiente fase: dominio, correo y salida a producción

Guía corta para poner la tienda en línea. Sigue los pasos en orden. Los detalles técnicos de cada paso están en `docs/deploy.md` y en `docs/stripe-setup.md`.

## 1. Dominio

- **Qué comprar:** `artwithgab.at`, y si está libre también `artwithgab.com`, para redirigirlo al `.at`. El `.at` transmite confianza en Austria.
- **Dónde:** cualquier registrador sirve. Hay dos tipos:
  - Registrador austríaco, como **easyname** o **World4You**: el dominio suele incluir buzones de correo y facturan en euros con IVA austríaco.
  - Registrador internacional, como **Cloudflare Registrar** o **Namecheap**: el dominio suele ser más barato, pero el correo va aparte.
- **Recomendación:** si quieres lo más simple, compra en un registrador austríaco que incluya correo. Así tienes dominio y buzón en un solo lugar.

## 2. Correo: hacen falta dos cosas distintas

| Para qué | Qué es | Recomendación |
|---|---|---|
| **Buzón para personas:** leer y responder a clientes, por ejemplo `hallo@artwithgab.at` | Correo normal con webmail o app | El correo que incluya el registrador (paso 1) o **Zoho Mail** con centro de datos en la UE. Google Workspace también sirve, pero es más caro. |
| **Envío automático de la app:** avisos de pedidos y confirmación de la lista de espera | SMTP transaccional | **Brevo**, empresa francesa con servidores en la UE y plan gratuito con un límite diario de envíos que alcanza de sobra para esta temporada. Alternativas: Mailjet (también UE) o Postmark. |

Los precios y los límites de los planes cambian. Revísalos en la página de cada proveedor antes de contratar.

Por qué un servicio transaccional y no el buzón: los avisos automáticos llegan mejor a la bandeja de entrada (no a spam) si salen de un servicio pensado para eso, con SPF, DKIM y DMARC configurados.

**Pasos con Brevo:**
1. Crea la cuenta y añade el dominio. Brevo te da registros DNS (SPF, DKIM, DMARC). Cópialos en el panel DNS del registrador.
2. Crea el remitente `pedidos@artwithgab.at` y una clave SMTP.
3. Rellena estas variables en el `.env` del servidor:
   ```
   MAIL_HOST=smtp-relay.brevo.com
   MAIL_PORT=587
   MAIL_USERNAME=<usuario SMTP de Brevo>
   MAIL_PASSWORD=<clave SMTP de Brevo>
   MAIL_FROM=pedidos@artwithgab.at
   OWNER_EMAIL=<tu correo, donde quieres los avisos>
   ```
4. Haz un pedido de prueba y comprueba que llegan los dos correos, el del dueño y el del cliente.

## 3. Servidor

- **Qué necesitas:** un servidor virtual pequeño (VPS) en la UE, con 2 vCPU, 4 GB de RAM y Docker. Ejemplos: **Hetzner Cloud** (Alemania o Finlandia) o **netcup**, ambos baratos y con centros de datos en la UE (bueno para el RGPD).
- **Pasos:** sigue `docs/deploy.md`.
  1. Instala Docker.
  2. Copia `.env.deploy.example` a `.env` y rellénalo.
  3. Ejecuta `docker compose up -d --build`.
  4. Pon HTTPS: Caddy o nginx con Let's Encrypt, como explica `docs/deploy.md`.
- **DNS:** crea un registro `A` de `artwithgab.at`, y otro de `www`, con la IP del servidor.
- **Copias de seguridad:** activa los snapshots del proveedor o un `pg_dump` diario, y guarda también la carpeta de fotos.

## 4. Stripe en vivo

1. Termina la prueba en modo test (`docs/stripe-setup.md`).
2. En Stripe, activa la cuenta con los datos de la empresa y la cuenta bancaria.
3. Crea el webhook de producción en `https://artwithgab.at/api/shop/stripe/webhook`.
4. Pon en `.env` la clave `sk_live_...` y el `whsec_...` del webhook en vivo. Las claves nunca van en Git.
5. Activa la tienda con `SHOP_ENABLED=true` y haz una compra real pequeña. Después la puedes reembolsar.

## 5. Antes de abrir al público

- [ ] Completar los datos de `/impressum`, `/agb` y `/datenschutz`, y que un asesor los revise. Revisar en concreto:
  - el botón "Zahlungspflichtig bestellen";
  - que los adornos personalizados no se pueden devolver (§ 18 FAGG);
  - los plazos de borrado de datos: 60 días después de la entrega y 7 años para la contabilidad.
- [ ] Mencionar en `/datenschutz` a los proveedores que tratan datos: el hosting, Brevo y Stripe.
- [ ] Crear el stock real de rojo, verde y beige, en brillante y en mate, en *Stock* (`/staff/inventory`).
- [ ] Contraseñas del staff: `STAFF_GABY_PASSWORD` y `STAFF_ANDRES_PASSWORD`, de 10 caracteres o más. Cámbialas después en *Change password*.
- [ ] Revisar `SHOP_DELIVERIES_FROM` (primer día con entregas: 2026-11-30) y `SHOP_SEASON_END` (2026-12-24).

## 6. Pendientes para más adelante

- **Lista de espera:** una pantalla para ver los e-mails y el envío automático cuando abra la temporada 2027. La confirmación por e-mail (doble opt-in) ya está hecha.
- **Avisos inteligentes con agentes**, cuando todo lo anterior funcione.
