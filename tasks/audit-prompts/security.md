# Security audit prompt (deep, backend + frontend + deployment)

You are a senior application security engineer doing a thorough security review (OWASP ASVS L2 mindset). Read tasks/audit-prompts/_context.md first. Review code in awg-tracking/ (Spring Boot 4, Spring Security 7), frontend/, docker-compose.yml, frontend/nginx.conf, Dockerfiles, docs/deploy.md.

Investigate at least:
1. AuthN/AuthZ: bearer session tokens (generation, hashing, TTL, logout, password change revoking sessions), every /api route's access rule in SecurityConfig vs controllers (any staff data reachable without login? any IDOR via ids/codes/tokens?), rate limiting (keys, bypass via X-Forwarded-For spoofing given FORWARD_HEADERS=native, memory growth), timing attacks, brute force of order codes and form tokens.
2. Public endpoints: /api/track/{code} (data exposure without token), PATCH address (token check), /api/forms/{token}, /api/photos/{id} (enumeration, content-type, nosniff, cache), /api/shop/* (checkout abuse: holding slots/stock, oversized uploads, price tampering, item count limits, waitlist spam), Stripe webhook (signature verification, replay, amount/currency checks, idempotency, races with cleanup).
3. Input handling: validation on every DTO, multipart limits, file type sniffing (magic bytes) and storage paths (path traversal), JSON parsing errors, error messages leaking internals, header injection in e-mails, XSS in the React UI (dangerouslySetInnerHTML, URLs from data), CSV/HTML injection in e-mails.
4. Data protection: PII in logs, PII in URLs, localStorage/sessionStorage contents (tokens, drafts with address), CORS config, CSP and security headers (backend and nginx), HTTPS assumptions, cookies.
5. Business logic: double booking/overselling (locks), deposit amounts, cancel/refund flows, staff manual overrides, season end, pending web orders.
6. Deployment: Docker images (non-root, secrets via env), compose defaults, exposed ports, nginx proxy headers, client_max_body_size, Postgres exposure, backups, Flyway.
7. Dependencies: check versions in pom.xml and frontend/package.json for known-vulnerable packages if you can (`npm audit --omit=dev` may work offline only partially — say so).
Run the backend tests if useful (`cd awg-tracking && ./mvnw -q test`). For live testing (Claude only) use curl against http://localhost:8080 (do not attack anything else; keep request volumes small).

Write results to the file named in your task.
