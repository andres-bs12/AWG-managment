# Auditoría de seguridad (Claude) — ArtWithGab, 2026-11-05

Alcance: `awg-tracking/` (Spring Boot 4.1.1 / Spring Security 7), `frontend/`, `docker-compose.yml`, `frontend/nginx.conf`, Dockerfiles, `docs/deploy.md`. Revisé el código completo y confirmé con `curl` contra `http://localhost:8080` (perfil dev, tienda activa con clave Stripe dummy). No modifiqué archivos del proyecto. La única compra que intenté (checkout) terminó en 502 y se revirtió: el stock siguió en 200 y no quedó ningún pedido mío. Al terminar cerré la sesión de staff.

## Hallazgos (de mayor a menor severidad)

### 1. Alta · `/api/shop/checkout` · `ShopService.java:183-307`, `ShopController.java:44`: cualquiera puede bloquear la capacidad de pintura y el stock sin pagar
- **Qué observé:** el checkout reserva los huecos de pintura (`plan`, l.216), descuenta stock (`inventoryService.deductItem`, l.269) y guarda el pedido `PENDING` *antes* de crear la sesión de Stripe. La reserva dura `checkoutMinutes` (30) + 2 min hasta `expires_at`, y `releaseExpired` solo la libera 10 min después de ese plazo (l.356), es decir, unos 42 min. El único freno es de 5 checkouts/min por IP, cada uno con hasta 10 ornamentos (`MAX_ITEMS`) y 60 MB de fotos. Ni el email ni el teléfono pasan por verificación. En vivo, un payload con precio manipulado (`"cost":0.01,"total":0.01`) y una "foto" mínima superó todas las validaciones y llegó a la llamada a Stripe (502 por la clave dummy). Con una clave real, el pedido habría quedado `PENDING`, reteniendo hueco y stock.
- **Por qué importa:** una sola IP retiene 50 huecos por minuto. Con 2 pinturas/día por defecto y una ventana de 60 días, en 2 o 3 minutos no quedan fechas en `/buy` y el puesto tampoco puede vender custom, porque la capacidad es compartida y los PENDING "ocupan horas". El stock de producción por color es 3 (`INITIAL_CUSTOM_STOCK`), así que bastan 1 o 2 checkouts para dejar sin bases todos los colores. Además ocupa unos 12 GB de disco por IP durante la reserva. Por si fuera poco, el checkout mantiene el lock de fila `ScheduleLock` mientras escribe las fotos y espera a Stripe (hasta 20 s, l.191-301), y `releaseExpired` también lo mantiene mientras consulta Stripe pedido por pedido (l.358-378). Así, el ataque además frena todas las operaciones de staff que reservan tiempo.
- **Cómo corregirlo:** (a) poner un límite global de ítems `PENDING` simultáneos (por ejemplo, ≤ 15) y un límite por email, teléfono e IP (1 pedido pendiente); (b) bajar el rate limit a 2/min y añadir uno por hora (≤ 6/h); (c) no descontar stock hasta `confirmIfPaid`, o reservar como mucho N unidades por color para la web; (d) sacar la llamada a Stripe del lock: reservar y hacer commit, llamar a Stripe y, si falla, liberar en una transacción aparte. En `releaseExpired`, consultar Stripe fuera del lock; (e) considerar un desafío anti-bot (Turnstile o hCaptcha) solo en el checkout.

### 2. Alta · Repositorio · `/.gitignore`: el `.env` de despliegue con todos los secretos no está ignorado
- **Qué observé:** `docs/deploy.md` indica copiar `.env.deploy.example` a `.env` en la raíz. El `.gitignore` raíz solo contiene `.DS_Store`, `*.zip`, `.cursor/`, `awg-tracking/data/` y `tasks/.agent-heartbeat`. `git check-ignore -q .env` devuelve 1 (no ignorado). Solo `frontend/.gitignore` ignora `.env`.
- **Por qué importa:** un `git add -A` o `git commit -a` en el servidor o en el equipo del dueño subiría a GitHub `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DB_PASSWORD`, `MAIL_PASSWORD` y las contraseñas de staff. AGENTS.md lo prohíbe expresamente. Revisé el historial (`git log --all -- .env`) y no hay ningún `.env` subido.
- **Cómo corregirlo:** añadir a `/.gitignore` las líneas `.env`, `.env.*` y `!.env.deploy.example`, y también `awg-tracking/.env*`.

### 3. Media · Frontend en producción · `frontend/nginx.conf`: no hay cabeceras de seguridad y el token de staff vive en `localStorage`
- **Qué observé:** el nginx que sirve la SPA no envía `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options` ni `Permissions-Policy`, y deja `server_tokens` activo (muestra la versión). El backend sí las envía (lo comprobé con `curl -D -`: `CSP default-src 'none'`, `X-Frame-Options: DENY`, `nosniff`), pero eso no protege el HTML. El token bearer (12 h) está en `localStorage` (`AuthContext.tsx:42`, `api/http/services.ts:34`).
- **Por qué importa:** sin CSP, cualquier XSS o script de terceros comprometido roba el token de staff y con él el acceso a todos los datos personales. Sin `frame-ancestors`, las páginas de staff (cancelar pedido, marcar pago) se pueden incrustar en un iframe para clickjacking. Sin HSTS, una primera visita por HTTP se puede degradar.
- **Cómo corregirlo:** en `server {}`: `add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://checkout.stripe.com" always;`, además de `X-Frame-Options DENY`, `Referrer-Policy no-referrer`, `X-Content-Type-Options nosniff`, `Strict-Transport-Security "max-age=31536000"` (o ponerla en el proxy TLS) y `server_tokens off;`. Para el token, valorar guardarlo en `sessionStorage` o en una cookie `HttpOnly; Secure; SameSite=Strict`.

### 4. Media · `/api/staff/login` · `AuthController.java:30`, `config/Bootstrap.java:78`: la protección contra fuerza bruta es solo por IP y las contraseñas iniciales pueden ser débiles
- **Qué observé:** el único límite es de 10 intentos/min por `remoteAddr`. No hay límite por cuenta, ni backoff, ni límite global. `Bootstrap` acepta contraseñas iniciales desde 4 caracteres, aunque el cambio de contraseña exige 10. Los emails de staff (`gaby@…`, `andres@…`) aparecen en el bundle de producción (hallazgo 12).
- **Por qué importa:** con muchas IPs (botnet, rotación de IPv6) el ataque no tiene límite real y solo hay dos cuentas, que además se conocen. Quien acierte la contraseña obtiene todos los datos personales y puede cancelar o borrar pedidos.
- **Cómo corregirlo:** añadir un limitador por email normalizado (por ejemplo, 5 fallos cada 15 min con bloqueo temporal) además del de IP, exigir ≥ 12 caracteres en `Bootstrap` (y negarse a arrancar con menos fuera del perfil dev) y opcionalmente avisar al dueño por email cuando haya muchos fallos.

### 5. Media · Cancelar un pedido web pendiente · `OrderService.java:276-283`: el pedido se borra pero la sesión de Stripe sigue abierta
- **Qué observé:** `cancelOrder` no comprueba `isAwaitingPayment()`, a diferencia de `updatePaymentState` (l.224), y no expira la sesión de Stripe. Si el cliente paga después, el webhook no encuentra el pedido y solo deja un `log.error("PAID Stripe session … has no order")` (`ShopService.java:329`). Al cancelar un pedido web ya pagado tampoco hay reembolso ni aviso al dueño.
- **Por qué importa:** se cobra sin pedido y sin capacidad reservada. Hay que devolver el dinero a mano, y en la práctica el problema solo se ve en los logs.
- **Cómo corregirlo:** si el pedido está `PENDING`, llamar a `POST /v1/checkout/sessions/{id}/expire` antes de borrar (o rechazar con 409). Si está pagado, mostrar en la UI "Reembolsar en Stripe" y mandar un email al dueño cuando llegue un pago sin pedido.

### 6. Media · Privacidad (RGPD) · `frontend/index.html:9-13`, `src/content/legal.ts:34`: Google Fonts se carga desde Google sin consentimiento
- **Qué observé:** cada visita pública carga CSS y fuentes desde `fonts.googleapis.com` y `fonts.gstatic.com`, con lo que la IP del visitante llega a Google. La Datenschutzerklärung asegura que no hay terceros de tracking y solo menciona Stripe, email y hosting.
- **Por qué importa:** en la UE (LG München, 3 O 17493/20) se han reconocido indemnizaciones por esto, y en Austria circularon cartas de reclamación masivas contra webs con Google Fonts. Además, el texto legal no coincide con lo que hace la web.
- **Cómo corregirlo:** servir las fuentes desde la propia web (descargar los woff2 a `public/fonts` y declararlos con `@font-face`) y quitar los `<link>` a Google.

### 7. Media · Rate limiting · `security/RateLimiter.java`, `docker-compose.yml` (`FORWARD_HEADERS: native`): el límite por IP en memoria es frágil según el despliegue
- **Qué observé:** la clave es `request.getRemoteAddr()` completa. En local, sin forward headers, lo comprobé con 32 peticiones a `/api/track/AWGZZZZ`, cada una con un `X-Forwarded-For` distinto: llegó el 429 en la 28.ª, así que un XFF falsificado no salta el límite. En compose, Tomcat `RemoteIpValve` toma la IP no interna más a la derecha, lo que impide falsificarla a través de nginx. Pero: (a) con IPv6 cada /128 es una clave distinta y un atacante con un /64 rota sin límite; (b) si el proxy TLS externo que pide `deploy.md` tiene IP pública (un balanceador gestionado, Cloudflare), todos los clientes comparten esa IP: 10 logins/min y 30 consultas de Track/min para todo el mundo, con lo que cualquiera bloquea el login del staff; (c) es una ventana fija, que admite ráfagas del doble justo en el límite.
- **Por qué importa:** casi toda la defensa de los endpoints públicos (hallazgos 1, 4 y 8) depende de este limitador.
- **Cómo corregirlo:** normalizar IPv6 a /64; documentar en `deploy.md` que el proxy externo debe estar en red privada o configurar `server.tomcat.remoteip.internal-proxies` con su IP; añadir `limit_req_zone` en nginx para `/api/staff/login` y `/api/shop/checkout` como segunda capa.

### 8. Baja · `/api/track/{code}` · `TrackingService.java:75, 91-100`: los códigos antiguos de 4 cifras siguen activos y Track expone datos sin token
- **Qué observé:** la expresión regular acepta `AWG` + 4–6 caracteres. `GET /api/track/AWG2222` (sin token) devuelve `customerName:"Lena"`, `petName:"Mimi"`, `backName:"MIMI"`, `total:102.97`, `paymentState:"deposit"`, fecha y mercado de recogida (`Rathausplatz`, 27-11, 14:00). Con códigos de solo 4 cifras hay 10.000 posibilidades, que a 30/min por IP se recorren en unas 5 h desde una sola IP (o en minutos desde varias).
- **Por qué importa:** permite enumerar nombre, mascota, deuda pendiente y el lugar y la hora exactos de la recogida. Los códigos nuevos (32^6) no tienen este riesgo.
- **Cómo corregirlo:** en producción, no aceptar códigos de 4 caracteres (o migrarlos). Valorar mostrar `total`/`paymentState`/`backName` solo con `X-Form-Token`.

### 9. Baja · Token del formulario · `FormService.java:31-55`, `api/http/services.ts:54`: el token no caduca, se guarda para siempre y aparece en las URLs
- **Qué observé:** `/api/forms/{token}` devuelve email, teléfono, notas y fotos sin límite de tiempo, incluso después de la entrega (lo comprobé con AWG2222, `handedOver:true`). El navegador guarda `awg-form-token:<CODE>` en `localStorage` sin fecha de borrado, y la Datenschutz no lo menciona. El token va en la ruta (`/form/<token>`, `/api/forms/<token>`), así que queda en los access logs de nginx y del proxy.
- **Por qué importa:** en un dispositivo compartido, o con acceso a los logs, se pueden ver los datos personales y la dirección mucho después de cerrar el pedido.
- **Cómo corregirlo:** invalidar (o dejar en solo lectura y sin datos personales) el formulario X días después de la entrega o la cancelación; borrar `awg-form-token:*` al ver el estado `delivered`; no registrar `/form/` ni `/api/forms/` en los logs de nginx (`map` + `access_log … if=`); `Referrer-Policy: no-referrer`.

### 10. Baja · Webhook o limpieza con importe distinto · `ShopService.java:381-388, 371-373`: el pedido queda en un bucle eterno
- **Qué observé:** si `amount_total`/`currency` no coinciden, `confirmIfPaid` sale sin cambiar nada. `releaseExpired` verá la sesión `complete` cada 5 min y repetirá lo mismo indefinidamente, con el lock tomado, mientras el pedido sigue ocupando hueco y stock y solo queda un `log.error`.
- **Por qué importa:** retiene capacidad para siempre y el cobro irregular pasa desapercibido.
- **Cómo corregirlo:** pasar a un estado `REVIEW` (que no se reintente), avisar al dueño por email y mostrarlo en la UI de staff.

### 11. Baja · Fotos · `PhotoStorageService.java:39-69`: solo se revisan los primeros bytes y el EXIF (con GPS) se guarda y se sirve en público
- **Qué observé:** basta con que el archivo empiece por `FF D8 FF` para pasar como JPEG. En vivo, `\xff\xd8\xff<html><script>alert(1)</script></html>` con `type=text/html` pasó la validación (el checkout llegó al paso de Stripe). El archivo se guarda tal cual y `/api/photos/{uuid}` lo sirve sin autenticación (`Cache-Control: private, max-age=2592000`). El XSS está mitigado, porque comprobé que se sirve como `Content-Type: image/jpeg` con `nosniff` y `CSP default-src 'none'`. Pero los metadatos EXIF, como la ubicación GPS de la foto tomada en casa del cliente, se conservan.
- **Por qué importa:** el riesgo principal es la privacidad: la dirección aproximada del cliente queda accesible para cualquiera que tenga la URL de la foto.
- **Cómo corregirlo:** decodificar y volver a codificar la imagen en el servidor (ImageIO o TwelveMonkeys para HEIC/WebP), con lo que se pierden EXIF y contenido políglota, o como mínimo eliminar los segmentos APP1/EXIF.

### 12. Baja · Bundle de producción · `frontend/src/api/client.ts:2-3`: el mock con contraseñas demo y emails de staff entra en el build
- **Qué observé:** `client.ts` importa `mockApi` de forma estática. En `dist/assets/client-*.js` aparecen `email:"gaby@artwithgab.com",password:"gaby"` y la entrada de Andres, y `LoginPage-*.js` incluye el texto de ayuda con ambas cuentas (oculto en modo http, pero presente).
- **Por qué importa:** revela las cuentas reales de staff (objetivo de fuerza bruta y phishing) y las contraseñas del perfil dev. Si alguien despliega con el perfil dev, son credenciales válidas.
- **Cómo corregirlo:** cargar el mock con `import()` dinámico dentro de `if (import.meta.env.VITE_DATA_SOURCE !== 'http')` para que Vite lo elimine del build de producción.

### 13. Baja · `/api/shop/waitlist` · `ShopService.java:89-101`: lista de espera sin doble opt-in ni forma de darse de baja
- **Qué observé:** guarda cualquier email (5/min por IP) sin confirmación, sin límite de tamaño de tabla y sin endpoint de baja. Además acepta inscripciones aunque la tienda esté abierta.
- **Por qué importa:** según el RGPD hay que poder demostrar el consentimiento. Cualquiera puede inscribir emails ajenos y llenar la tabla.
- **Cómo corregirlo:** enviar un email de confirmación con token (doble opt-in) y un enlace de baja, y rechazar inscripciones si `seasonOver == false`.

### 14. Baja · Retención de datos: la Datenschutz promete borrar fotos y direcciones antes del 31-01-2027, pero no existe ningún mecanismo
- **Qué observé:** los únicos `@Scheduled` son `AuthService.purgeExpired` y `ShopService.releaseExpired`. No hay purga de fotos, direcciones ni lista de espera (`legal.ts:33`).
- **Por qué importa:** el texto legal promete algo que la aplicación no hace, y los datos personales se acumulan sin límite.
- **Cómo corregirlo:** añadir una tarea programada (o un comando de staff) que borre fotos y `delivery_address` de los pedidos entregados después de la fecha configurada.

### 15. Baja · Despliegue · `frontend/Dockerfile`, `docker-compose.yml`: falta endurecimiento
- **Qué observé:** el proceso maestro de nginx corre como root (imagen por defecto) y no se usa `nginxinc/nginx-unprivileged`. El backend no tiene `healthcheck` y `frontend` arranca sin esperar a que el backend esté listo. Las copias de seguridad son manuales y sin cifrar (`deploy.md`). No hay `limit_req` ni timeouts de proxy. En el lado bueno: Postgres no publica puertos y el backend corre como usuario `awg`.
- **Cómo corregirlo:** usar `nginxinc/nginx-unprivileged:1.27-alpine` (escuchando en 8080), añadir un healthcheck a `/api/health` con `depends_on: condition: service_healthy`, y automatizar `pg_dump` cifrado (restic/age) fuera del servidor.

## Qué está bien
- Sesiones de staff: tokens aleatorios de 256 bits guardados como SHA-256, TTL de 12 h, purga programada. `logout` invalida el token (comprobado en vivo: 200 → 204 → 401) y el cambio de contraseña revoca las demás sesiones. El login usa un hash ficticio para no filtrar por tiempo qué emails existen.
- Autorización: todo `/api/**` exige `ROLE_STAFF` salvo una lista blanca mínima (comprobado en vivo: `/api/orders`, `/api/inventory` y `/actuator` responden 401). Para cambiar la dirección en Track hace falta el token largo del formulario, comparado en tiempo constante (403 sin él o con uno erróneo). `setItemStatus` verifica que el ítem pertenece al pedido.
- Pagos: el servidor calcula los precios (los campos `cost`/`total` del cliente se ignoran). El webhook verifica la firma HMAC en tiempo constante con 5 min de tolerancia (firma inválida → 400) y comprueba importe y moneda. Hay `Idempotency-Key` en Stripe y el estado es idempotente.
- Entrada y errores: validación de DTOs con tamaños máximos, multipart limitado (10 MB por archivo y 60 MB por petición, coherente con nginx), tipo de archivo detectado por los primeros bytes, nombres de archivo aleatorios y protección contra path traversal en `load`. Los errores se devuelven sin detalles internos (`include-message=never`, manejador global). La cabecera de los emails está saneada contra CRLF.
- Dependencias y secretos: `npm audit --omit=dev` → 0 vulnerabilidades. Compose obliga a definir los secretos (`:?`), Postgres no expone puertos, Flyway en modo `validate` y no hay secretos en el historial de git (busqué `sk_*`/`whsec_*`).

## Qué NO pude probar
- El flujo real de Stripe (sesión, webhook firmado, expiración y limpieza): la clave es dummy, así que el hallazgo 1 está confirmado con el código y con un checkout que llegó a Stripe, no con un pedido `PENDING` real.
- nginx y Docker Compose en ejecución (cabeceras reales del frontend, `RemoteIpValve` detrás de nginx, IPv6), ni el envío de emails (sin SMTP).
- El rate limit del login en vivo: no lo forcé para no bloquear la IP compartida con los demás auditores. El de Track sí lo comprobé.
- Un análisis de CVEs de las dependencias Maven (no hay herramienta sin conexión) ni los tests del backend (`./mvnw test`, no ejecutados).
- Nota: durante la auditoría apareció en la agenda un pedido `AWGZ44PG7` que no creé yo (probablemente de otro auditor). No lo toqué.
