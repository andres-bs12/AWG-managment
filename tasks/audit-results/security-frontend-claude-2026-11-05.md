# Frontend security audit — Claude — 2026-11-05

Scope: `frontend/src/**`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/nginx.conf`, `frontend/Dockerfile`, `docker-compose.yml`, and how the client talks to the backend (`frontend/src/api/http/services.ts`, `frontend/src/lib/*`). Read-only review of the working tree on `feat/backend-domain` (uncommitted changes included). Backend files were opened only to confirm how a frontend behaviour is enforced.

No High findings. No XSS sink was found, and the CSP blocks inline and third-party scripts.

---

## Medium

### M1. Form tokens stay in `localStorage` indefinitely, including on the staff stall device. Anyone with that browser can read and redirect Vienna deliveries
- **Evidence:** `frontend/src/api/http/services.ts:56-73` (`rememberFormToken` / `formTokenHeader`), `:288` (stored on every `getForm`, so merely *opening* `/form/:token` stores it), `:296`, `:317`. The token is removed only on checkout abandon (`:305`) and staff cancel (`frontend/src/pages/staff/OrderDetailPage.tsx:125`). Staff open customer forms on their own device via `OrderDetailPage.tsx:136` ("Open customer form") and `NewSalePage.tsx:680`. `TrackPage.tsx:114` uses the stored token to unlock address view and edit. On the backend, `TrackingService.java:40,48-61` returns the address and accepts `PATCH /api/track/{code}/address` when `X-Form-Token` matches.
- **Attack scenario:** A customer fills their form on the stall tablet. That tablet now holds a long-lived token for every such order, in `localStorage`, which survives tab and browser restarts. Anyone who later has that browser can open `/track/AWGxxxx` for a stored code. That includes the next customer handed the tablet, someone who picks it up, or someone with a lost or stolen phone. They see the customer's first name and full Vienna address and can **change the delivery address**, which diverts the ornament. This keeps working until the form link expires (30 days after handover). Customers using a shared or family computer have the same exposure.
- **Minimal fix:**
  1. Do not persist the token on `getForm`. Store it only after a successful `submitForm` or `checkout`.
  2. Use `sessionStorage`, or store `{token, expiresAt}` and drop entries older than about 60 days on app start.
  3. In the staff flow (`/form/:token` opened while a staff session exists, or a `?staff=1` marker from the staff buttons), skip `rememberFormToken` and clear the form draft on submit.

---

## Low

### L1. `?cancelled=CODE` abandons a checkout from a plain GET link (cross-site state change)
- **Evidence:** `frontend/src/pages/public/BuyPage.tsx:76`. Any visit to `/buy?cancelled=X` calls `api.shop.abandonCheckout(X)`, which sends the stored `X-Form-Token` (`services.ts:305`). The backend (`ShopService.java:101-112`) releases the order and expires the Stripe session if it is not yet complete.
- **Attack scenario:** Someone who knows a buyer's order code sends them `https://<site>/buy?cancelled=AWGxxxx` while their Stripe payment is still open in another tab or on another step. Codes are short and shown on Track and in e-mails. Opening the link frees the slot and stock and kills the Stripe session, so the buyer has to start again and may lose the date. The impact is limited because an already completed payment is reconciled and kept.
- **Minimal fix:** Write a `sessionStorage` marker (`awg-pending-checkout=<code>`) just before `window.location.assign(checkoutUrl)`. Abandon only when the `cancelled` code equals that marker, then clear the marker. Otherwise show the notice without calling the API.

### L2. `checkoutUrl` is followed without validation
- **Evidence:** `frontend/src/pages/public/BuyPage.tsx:252` passes `result.checkoutUrl` from `POST /api/shop/checkout` straight to `window.location.assign`.
- **Attack scenario:** This needs a compromised or misconfigured backend, a hostile `VITE_API_BASE_URL`, or a proxy rewriting the response. The client would then send a paying customer to any URL, including a phishing payment page or a `javascript:` URL. The CSP would block inline script execution, but not navigation. The risk is low because the URL comes from our own API, but the redirect happens right as the customer is about to pay.
- **Minimal fix:** Before calling `window.location.assign(url)`, run `const u = new URL(result.checkoutUrl, location.origin)` and allow it only if `u.protocol === 'https:' && u.hostname === 'checkout.stripe.com'` or `u.origin === location.origin` (the mock). Otherwise show `shopCheckoutError`.

### L3. Staff bearer token in `localStorage`; logout can fail open and leaves staff drafts behind
- **Evidence:** `frontend/src/auth/AuthContext.tsx:23,42` and `services.ts:18,38-44` keep the token in `localStorage`, which persists across browser restarts. `AuthContext.tsx:47-52`: `logout` awaits `api.auth.logout()` *before* removing the token. On a network error at the stall the promise rejects, `StaffLayout.tsx:62` swallows it with `void`, and the token and UI state stay logged in. Logout also does not clear `awg-sale-draft` (`pages/staff/saleDraft.ts:6,73`). That draft holds the created order's `formToken` and any Vienna address (`saleDraft.ts:12-18,38-43`).
- **Attack scenario:** Staff tap "Log out" on a shared or market device with a flaky connection. The session silently stays active and the next person keeps full staff access, including customer PII and payment state. Separately, any future XSS could read a long-lived token from `localStorage`.
- **Minimal fix:** In `logout`, clear local state first. Remove the token, `awg-sale-draft` and `awg-staff-hub`, then call the server in a `try/finally` that ignores errors. Consider `sessionStorage` for the token, which still survives reloads, so the session does not outlive closing the browser on shared devices.

### L4. `.ics` export does not escape text values (CR/LF, `,` `;` `\`)
- **Evidence:** `frontend/src/pages/public/BuyThanksPage.tsx:58-60` interpolates `when.marketName` (from the API, entered by staff in the market editor) into `SUMMARY:` and `LOCATION:` without escaping. `code` comes from the `?code=` query string and goes into `UID:`.
- **Attack scenario:** A market name containing a newline (by mistake or from a compromised staff account) injects extra iCalendar properties. Examples are `ATTACH:`/`URL:` pointing to a phishing site, `VALARM`, or a different `DTSTART`, all inside a file the customer imports into their calendar. A stray `,`/`;` silently corrupts the event. `code` is only exploitable if the backend Track lookup accepted a code with trailing junk, which is unlikely because `TrackingService.java:82` validates `AWG[A-Z0-9]{4,6}`. Treat that part as hardening.
- **Minimal fix:** Add `const ics = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n|\r/g, '\\n').replace(/[,;]/g, m => '\\' + m)` and apply it to SUMMARY, DESCRIPTION, LOCATION and UID. Also restrict `code` to `/^AWG[A-Z0-9]{4,6}$/i` before building the file.

### L5. Production build silently falls back to the mock (demo passwords in the bundle) when `VITE_DATA_SOURCE` is not `http`
- **Evidence:** `frontend/vite.config.ts:7` aliases `data-source`/`demo-source` to the mock unless `VITE_DATA_SOURCE === 'http'`. `frontend/.env` sets `mock`. The mock bundle contains the staff accounts with plaintext passwords (`gaby`/`andres`; confirmed in the local `frontend/dist/assets/client-*.js`) and `LoginPage.tsx:16,72` displays them. Every "staff check" runs in the browser against `localStorage`. The Dockerfile sets `ENV VITE_DATA_SOURCE=http` and `.dockerignore` excludes `.env`, so the documented Docker path is safe.
- **Attack scenario:** Someone runs `npm run build` locally and uploads `dist/` to static hosting. The existing `frontend/dist` is such a mock build. The public site then shows demo credentials and a fake staff area, and customer form data is kept only in each visitor's browser.
- **Minimal fix:** In `vite.config.ts`, throw when `command === 'build' && mode === 'production' && VITE_DATA_SOURCE !== 'http'`, unless an explicit `VITE_ALLOW_MOCK_BUILD=1` is set for demos/tests.

### L6. Client-IP trust chain behind the external TLS proxy (rate limits) — *needs confirmation*
- **Evidence:** `frontend/nginx.conf:27-28` forwards `X-Forwarded-For $proxy_add_x_forwarded_for`, which appends to whatever the client or upstream sent. `docker-compose.yml` sets `FORWARD_HEADERS: native` (Tomcat RemoteIpValve, which trusts private-range proxies). `docs/deploy.md:38` puts an external TLS proxy in front of nginx.
- **Attack scenario:** The outcome depends on the external proxy:
  - If it passes the client's `X-Forwarded-For` through without appending the real client IP, a client can send `X-Forwarded-For: <random>` and get a fresh rate-limit bucket per request. That bypasses the limits on checkout, Track, abandon, waitlist and login.
  - If the proxy has a public IP and nginx sees it as `$remote_addr`, every customer shares one bucket. One abuser can then lock everyone out of checkout or Track.
- **Minimal fix:** In nginx, use `set_real_ip_from <external proxy IP/CIDR>; real_ip_header X-Forwarded-For; real_ip_recursive on;`, then send `proxy_set_header X-Forwarded-For $remote_addr;` (overwrite, not append) to the backend. Document the external proxy requirement in `docs/deploy.md`. Also set `X-Forwarded-Proto https` because nginx's `$scheme` is always `http` here.

### L7. Dev-only dependency: outdated `@playwright/test` 1.49.1 (mismatched with `playwright-core` 1.64.1)
- **Evidence:** `frontend/package.json` devDependencies and `package-lock.json` (`@playwright/test` 1.49.1, `playwright-core` 1.64.1 pulled in by `@axe-core/playwright`). This is also the source of the known `helpers.ts:45` type conflict.
- **Risk:** Playwright before 1.55.1 has a published advisory: the browser download in its install script did not verify TLS on some platforms (*needs confirmation against the advisory DB; `npm audit` was not run*). This affects developer machines and CI only, not the shipped bundle.
- **Minimal fix:** Bump `@playwright/test` to the same version as the `playwright-core` used by `@axe-core/playwright`.

---

## Info / hardening

- **I1. nginx `add_header` inheritance:** `nginx.conf:34-39`. The `/assets/` block defines its own `add_header`, so it drops the server-level CSP, Referrer-Policy, X-Frame-Options and Permissions-Policy (only `nosniff` and Cache-Control are kept). Today it serves only our own hashed JS, CSS and SVG, so the impact is negligible. Add CSP there anyway if user-influenced SVG is ever served from `/assets/`.
- **I2. No HSTS:** nginx does not terminate TLS (`docs/deploy.md:38`). Make sure the external proxy sends `Strict-Transport-Security: max-age=31536000` (and redirects HTTP to HTTPS), because the app carries bearer tokens and form tokens.
- **I3. CSP `style-src 'unsafe-inline'`:** `nginx.conf:18,43`. React `style={}` props are applied through the CSSOM and do not need it. Check whether any library injects `<style>` before removing it. Low value, but it would tighten the policy.
- **I4. No `<meta name="referrer">` in `index.html`:** the `no-referrer` policy exists only as an nginx header. A non-nginx host (`vite preview`, a static host) would send `/form/<token>` as Referer on outgoing navigations. Today the only cross-origin link from public pages is Instagram, which already has `rel="noreferrer"`. Add the meta tag as a backstop.
- **I5. CORS `allowedHeaders` lacks `Idempotency-Key`:** `SecurityConfig.java:77` vs `services.ts:255`. This only matters if `VITE_API_BASE_URL` points to another origin, where staff sales would fail the preflight. It is a functional issue, not a vulnerability.
- **I6. Buy draft PII lifetime:** `lib/buyDraft.ts:60-73`. Name, e-mail, phone and address stay in `sessionStorage` (per tab, cleared on tab close). `clearBuyDraft` runs only when Track reports `paid` (`BuyThanksPage.tsx:38`), so it is not cleared after the 60 s confirmation timeout. That is acceptable, but you could also clear it on timeout once `?code=` matches a just-submitted checkout. Photos are never persisted (stripped in `saveBuyDraft`; `formDraft.ts:8-12` keeps only server photo ids). Form drafts are removed on submit (`FormPage.tsx:183`) but not when the form turns expired or locked.
- **I7. Access logs:** `nginx.conf:2-6` excludes `/form/` and `/api/forms/` correctly. `/track/<code>`, `/buy?cancelled=<code>` and `/buy/thanks?code=<code>` are logged. Order codes are public by design, so this is acceptable.
- **I8. Photo URLs are public capability URLs:** `GET /api/photos/{uuid}` is `permitAll` and cached `private` for 30 days (`PublicController.java:92-100`). `<img>` cannot send the bearer token, so this is by design. Note that browser caches may hold photos past the 60-day retention deletion.
- **I9. Staff map links send customer addresses to Google** (`OrderDetailPage.tsx:155`, `ViennaDeliveryCard.tsx:35`) when clicked. This is a privacy and GDPR note for the privacy policy, not a vulnerability.

---

## Checked and fine

- **XSS:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or `document.write` anywhere in `src/`. All API and user data is rendered as React text. Legal content is plain strings mapped to `<p>`/`<li>`. QR codes are rendered as a data-URL `<img>`.
- **URL sinks:** `href` values built from data use fixed schemes (`tel:`, `mailto:`, `https://www.google.com/maps/...` with `encodeURIComponent`), so `javascript:` injection is impossible. Image `src` values come from the API or local `FileReader` data URLs. Route params are `encodeURIComponent`-ed in API paths (`services.ts:207`) and in navigation (`TrackPage.tsx:273`, `BuyThanksPage.tsx:81`).
- **Login redirect:** `LoginPage.tsx:14` takes `from` from router *state* (not the URL) and navigates in-app, so there is no open redirect.
- **Waitlist tokens:** read from the hash and removed with `history.replaceState` before the API call (`WaitlistPage.tsx:15-16`), sent in the POST body, and never sent in Referer or logs.
- **Track token:** never placed in a URL. It is sent only as the `X-Form-Token` header and only for the matching code.
- **Metrics:** `BuyMetric` call sites send only enum-like values (step, color, finish, on/off, field *names*, required/invalid, SEQ 1–7). The backend enforces strict allowlists (`BuyMetricsService.java:16-30`). No personal data.
- **Dev-only code:** the `/dev/design` route and import are behind `import.meta.env.DEV` (`App.tsx:29,37`) and absent from the production bundle. `window.__awgMetrics` exists only in the mock module behind DEV/test/mock mode and is absent from `dist`. The HTTP demo stub exports empty demo credentials (`api/http/demo.ts`). Nothing imports `api/mock` outside the alias.
- **Secrets:** no `sk_`, `whsec_`, `pk_live`, AWS keys or hard-coded passwords outside the mock seed. `.env` and `dist` are git-ignored and docker-ignored. No source maps are emitted.
- **Headers:** a strict CSP (`script-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, a restrictive Permissions-Policy and `server_tokens off`. Fonts are self-hosted, so no third-party requests.
- **Staff route guard:** `StaffGuard` blocks rendering until `/api/staff/me` validates the token. Any staff 401 clears the token and redirects to login (`services.ts:89-96`). Authorization is enforced server-side (`/api/**` requires `ROLE_STAFF`).
- **CSRF:** authentication is a bearer header (no cookies), the backend is stateless with CSRF disabled appropriately, and CORS is restricted to configured origins. The only cross-site-triggerable state change found is L1.
- **Uploads:** photos are validated client-side (`lib/photoValidation.ts`) and sent as multipart blobs. The JSON payload carries only photo ids and names, and the server re-decodes the images.
- **Dependencies (runtime):** `react` 19.3.0, `react-router-dom` 7.18.4, `qrcode` 1.5.4 and `vite` 8.3.0 are current, with no known issues found by inspection (`npm audit` not run).
