**P0: none identified.** The highest-priority issue is that the origin accepts traffic from Cloudflare’s shared network without authenticating that it came through the AWG zone. The review is based on the repository and supplied infrastructure facts; I did not test the live server.

### P1

1. **Another Cloudflare customer may reach the origin around AWG’s edge controls.** The security group accepts Cloudflare’s shared IPv4 ranges, and Caddy has no zone-specific origin authentication. Another customer can point a proxied hostname at the known origin IP and, where their Cloudflare configuration permits the necessary Host/SNI override, route a request to the AWG Caddy site. That request bypasses rules applied specifically to the AWG zone. The outcome depends on the attacker’s Cloudflare features and configuration; the IP allowlist alone does not prove zone identity.  
   **Location:** supplied security group and Caddy configuration; [docs/deploy.md](/Users/andresbejarano/dev/AWG%20Tracking/docs/deploy.md:103).  
   **Fix:** authenticate origin requests with a **zone-specific or per-hostname client certificate** enforced by Caddy, or use Cloudflare Tunnel. Preserve a tested certificate-renewal path. Cloudflare’s shared global origin-pull certificate only authenticates its network, not an individual account. [Cloudflare origin authentication](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/).

2. **Rate limits are bypassable by distributing or rotating real client IPs, particularly IPv6.** Login allows ten attempts per minute **per address**, and tracking allows 30; neither has an account, code, subnet, or global limit. An attacker with an IPv6 allocation can rotate addresses even though EC2 has no IPv6 ingress: the browser connects to Cloudflare over IPv6, while Cloudflare connects to the origin over IPv4. This also enables enumeration of short tracking codes and can consume CPU on password checks.  
   **Location:** [AuthController.java](/Users/andresbejarano/dev/AWG%20Tracking/awg-tracking/src/main/java/com/artwithgab/awg_tracking/controller/AuthController.java:28), [PublicController.java](/Users/andresbejarano/dev/AWG%20Tracking/awg-tracking/src/main/java/com/artwithgab/awg_tracking/controller/PublicController.java:48), [RateLimiter.java](/Users/andresbejarano/dev/AWG%20Tracking/awg-tracking/src/main/java/com/artwithgab/awg_tracking/security/RateLimiter.java:26).  
   **Fix:** add account-oriented login throttling and bounded global limits, plus carefully chosen IPv6 prefix limits and Cloudflare edge rate rules. Avoid permanent account lockout that an attacker could weaponize.

### P2

3. **The forwarding boundary trusts the Docker network too broadly.** Caddy passes `CF-Connecting-IP` through; nginx trusts it from every address in `172.16.0.0/12`, then replaces `X-Forwarded-For`. Spring’s native Tomcat forwarding support also trusts private-network proxies by default. A compromised or newly attached container can therefore send forged forwarded IPs directly to the backend, or send a forged `CF-Connecting-IP` to nginx, bypassing per-IP limits or exhausting another visitor’s bucket. The backend is not directly Internet-exposed under the supplied configuration.  
   **Location:** [nginx.conf](/Users/andresbejarano/dev/AWG%20Tracking/frontend/nginx.conf:21), [docker-compose.yml](/Users/andresbejarano/dev/AWG%20Tracking/docker-compose.yml:33).  
   **Fix:** isolate frontend/backend and backend/database networks, explicitly restrict Tomcat’s trusted proxy to nginx, and make Caddy validate and overwrite the one client-IP header nginx consumes. Do not rely on a whole private CIDR as proof of proxy identity. [Caddy header handling](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Tomcat Remote IP Valve](https://tomcat.apache.org/tomcat-11.0-doc/config/valve.html).

4. **Tokenised links can enter error logs despite the access-log exclusion.** nginx excludes matching request URIs from its access log, but its error log can include the request line when an upstream or request-processing error occurs. Caddy or Cloudflare logging and diagnostics are additional potential copies if enabled. A logged `/form/<token>` or `/api/forms/<token>` grants access to the customer form. `no-referrer` helps normal browser navigation but does not sanitize server error logs.  
   **Location:** [nginx.conf](/Users/andresbejarano/dev/AWG%20Tracking/frontend/nginx.conf:1); supplied Caddy configuration.  
   **Fix:** audit and restrict existing error and edge logs, redact sensitive paths in every logging layer, and test forced upstream failures with a disposable token. Prefer moving the credential out of the URL path in a future compatible design.

5. **Unbounded logs and request work can fill the small instance’s disk or exhaust resources.** Compose sets no Docker log rotation; nginx logs ordinary requests and the backend can log exceptions. An attacker can generate sustained traffic, and form multipart parsing occurs before the controller’s rate-limit check. Disk exhaustion can stop PostgreSQL and make the site unavailable.  
   **Location:** [docker-compose.yml](/Users/andresbejarano/dev/AWG%20Tracking/docker-compose.yml:1), [PublicController.java](/Users/andresbejarano/dev/AWG%20Tracking/awg-tracking/src/main/java/com/artwithgab/awg_tracking/controller/PublicController.java:67).  
   **Fix:** configure bounded Docker log rotation and disk alerts; enforce request-rate and concurrent-upload limits at the edge or proxy, before multipart parsing.

6. **Secrets and personal data have a wider administrative exposure than `.env` permissions imply.** Database and initial staff passwords are injected into container environment variables; Docker administrators can inspect them, and membership in the `docker` group effectively grants host-root access. The encrypted EBS snapshots also contain `.env`, database records, photos, and potentially logs; anyone authorized to restore them with the relevant KMS access can retrieve that material. The deploy script itself does not transmit `.env` in its shown commands.  
   **Location:** [docker-compose.yml](/Users/andresbejarano/dev/AWG%20Tracking/docker-compose.yml:19), [deploy.sh](/Users/andresbejarano/dev/AWG%20Tracking/deploy/deploy.sh:16); supplied snapshot and host configuration.  
   **Fix:** restrict SSH, Docker, AWS snapshot and KMS access; audit snapshot sharing and restore permissions. Remove bootstrap staff passwords from the runtime environment after account creation, and rotate any secret exposed to an unauthorized administrator. Treat snapshot retention as extending data retention by up to seven days.

### P3

7. **HSTS coverage and the first HTTP request have gaps.** The supplied HSTS header applies to the apex Caddy site, not the separate `www` redirect site. A first-time visitor following an HTTP form link can expose its token before the redirect; HSTS only protects after a browser has learned a policy, unless preloaded. Cloudflare’s HTTPS redirect would shorten the plaintext path but cannot protect the initial HTTP request itself.  
   **Location:** supplied Caddy configuration; [docs/deploy.md](/Users/andresbejarano/dev/AWG%20Tracking/docs/deploy.md:45).  
   **Fix:** enable Always Use HTTPS at Cloudflare, add HSTS to HTTPS responses on both hostnames, issue only HTTPS QR links, and consider preload only after confirming all applicable subdomains are ready.

8. **Container and image hardening is incomplete.** The backend runs as a non-root user, but nginx’s image starts with its default root master; Compose has no explicit capability drops, `no-new-privileges`, resource limits, or read-only filesystems. Mutable base-image tags also make rebuilds less reproducible. A container compromise has more room to persist or consume host resources.  
   **Location:** [frontend/Dockerfile](/Users/andresbejarano/dev/AWG%20Tracking/frontend/Dockerfile:10), [docker-compose.yml](/Users/andresbejarano/dev/AWG%20Tracking/docker-compose.yml:1).  
   **Fix:** use an unprivileged nginx image, drop capabilities, add `no-new-privileges`, read-only filesystems with required writable mounts, and sensible resource limits; pin and regularly update image digests.

**Client-IP qualification:** For an ordinary request through the AWG Cloudflare zone, a browser-supplied `CF-Connecting-IP` is not by itself evidence of arbitrary spoofing: Cloudflare supplies the visitor address. Cross-zone Worker subrequests have special handling, and another customer’s proxied zone pointing at this origin must be tested separately; the supplied facts do not establish that it can set an arbitrary value. Same-zone Workers can alter the value through `x-real-ip`, so any future AWG Worker must also be trusted and reviewed. [Cloudflare HTTP header behavior](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

The current nginx `X-Forwarded-Proto` is `http` because Caddy connects to it over HTTP, so Spring may regard a public HTTPS request as insecure. Pass a sanitized, validated external scheme through the trusted proxy chain and verify redirects and security headers end to end. No files were modified.


---

## Disposición (Claude, 2026-11-06)

| # | Estado |
|---|---|
| P1-1 Otra zona de Cloudflare puede llegar al origen | Pendiente. Hoy no hay reglas por zona que saltarse; `CF-Connecting-IP` lo fija Cloudflare. Solución recomendada antes de añadir reglas de borde: Cloudflare Tunnel (sin puertos abiertos) o certificado de cliente propio. |
| P1-2 Límites por IP evitables rotando IPv6 | Corregido en parte: tope de 20 logins fallidos por minuto por cuenta (`AuthController`, test nuevo). Falta una regla de rate limiting en Cloudflare. |
| P2-3 Confianza en toda la red de Docker | Aceptado: requiere un contenedor comprometido. Pendiente separar redes. |
| P2-4 Tokens en el error log de nginx | Pendiente (bajo: solo en el servidor). |
| P2-5 Logs sin rotación | Corregido: `json-file` 10 MB × 3 en los tres servicios. |
| P2-6 Contraseñas iniciales en el entorno | Corregido: `STAFF_*` opcionales y ya vaciadas en el servidor tras el cambio de contraseñas. Snapshots: 7 días, cifrados. |
| P3-7 HSTS en www y HTTP hasta el origen | Corregido: certificado de origen de Cloudflare (CSR generada en el servidor), puerto 80 cerrado, "Always Use HTTPS" en Cloudflare y HSTS en los dos hosts. |
| P3-8 Endurecimiento de contenedores | Parcial: `no-new-privileges` en los tres. |
| Nota `X-Forwarded-Proto` | Corregido: nginx reenvía `https` cuando lo manda Caddy. |
