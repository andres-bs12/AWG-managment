# SEC-F frontend security handoff

2026-11-05 · Implementation complete; browser verification pending. Source: [Claude security audit](../tasks/audit-results/security-frontend-claude-2026-11-05.md). L1–L4 and L6 were preserved. No UI design, stock seed, screenshot references, accessibility assertions or legal copy changed. No commits.

## Implemented

- **M1:** `src/api/formTokens.ts` owns the HTTP/mock token policy. Form views do not write tokens. Successful submissions and checkout creation may write `{token, savedAt}` for 45 days. Reads never renew it; startup and reads remove expired, malformed, future-dated and undated legacy entries. Failure to access storage cannot fail the API operation. Track headers and its edit affordance use this reader.
- Staff handoff uses `?staff=1` on the local iPad URL only, after the existing logout. The marker survives reload and `FormPage` passes `rememberToken:false` on submit. An active staff session also prevents persistence. Successful submit removes the existing session draft. Logout clears all form-token keys, including legacy or unusual suffixes, before waiting on any network. QR/copy links remain suitable for the customer's own phone.
- Mock Track hides legacy-code names and all addresses without a matching, unexpired saved token. Address mutation rejects absent/expired ownership and handed-over orders, matching the relevant HTTP safeguards. Existing checkout abandonment still uses the matching token and deletes it afterwards.
- **L5:** production-mode Vite builds require `VITE_DATA_SOURCE=http`; the explicit `VITE_ALLOW_MOCK_BUILD=1` escape is for local previews only. `build:mock` sets both variables deliberately. Agent checks use `VITE_DATA_SOURCE=http npm run build`; Docker retains its existing HTTP environment.
- **I4:** the HTML includes `<meta name="referrer" content="no-referrer">` as a backstop on hosts without nginx headers.
- **I2:** deployment docs require HTTPS redirection and `Strict-Transport-Security: max-age=31536000` at the external TLS proxy. Actual proxy configuration/verification remains a deployment task.
- **I5:** the only Java implementation change adds `Idempotency-Key` to the existing CORS header allowlist. Three MockMvc tests cover accepted preflight, rejected origin and rejected extra header.

## Verification

- `VITE_DATA_SOURCE=http npm run build`: passed; the final local `dist` is HTTP. A scan of emitted JS found none of the checked mock-store/demo-account markers, and emitted HTML contains the referrer meta.
- `npm run build:mock`: passed. `VITE_DATA_SOURCE=mock VITE_ALLOW_MOCK_BUILD=0 npm run build`: rejected as intended with the explicit configuration error. The HTTP build was run last.
- `npm run lint`: passed with existing React warnings; token/style checks passed for 26 modules.
- `node --test tests/*.test.mjs`: 33/33 passed. The new token-storage and production-guard tests were first observed failing before implementation.
- `./mvnw -q test`: attempted; existing Mockito self-attach fails in the sandbox. Repeated with `-DargLine=-javaagent:/Users/andresbejarano/.m2/repository/net/bytebuddy/byte-buddy-agent/1.18.11/byte-buddy-agent-1.18.11.jar`: 95/95 passed, zero skipped. The CORS test first reproduced the missing allowed header before the one-line fix.
- Static TypeScript check of the three changed E2E specs: only the existing Playwright/axe `Page` incompatibility at `helpers.ts:45` remains. No new type errors were reported.
- `git diff --check`: passed.

No Playwright commands or browser sessions were run. Browser-dependent findings remain unverified. The HSTS deployment requirement is documented; no external proxy was configured or contacted.

## Claude follow-up

Run the current full Playwright suite normally, preserving the nine reviewed PNG references and all axe checks. In particular:

1. `form.spec.ts`: DE/EN customer submission stores a dated token and clears the draft; the HTTP/mock cases check view-only, rejected submission, staff suppression, customer success, names/address access, address mutation and expiry at exactly 45 days. The marked iPad UI case survives reload and submits without persisting.
2. `success.spec.ts`: actual mock checkout journeys assert the new dated record; the HTTP checkout case checks rejection without storage, success, token headers, Track editing and storage reuse after reload, followed by expiry.
3. `staff-review.spec.ts`: offline logout removes every saved customer token; the handoff URL must carry `?staff=1` and still prevent returning to authenticated tools.
4. Run DE/EN and mobile/desktop/iPad projects as configured. Preserve owner-approved layouts and stock revision 12; set sold-out state explicitly through the existing API helper where needed.

The prior `helpers.ts:45` Playwright/axe `Page` type conflict remains outside this task. No dependency changes were made. Legacy undated tokens are intentionally discarded because they have no trustworthy creation time; resubmitting the customer's form restores access where the server still permits it.
