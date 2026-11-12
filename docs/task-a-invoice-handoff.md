# Task A — invoice email and Vienna delivery window

Implementation finished on 2026-11-08 on `feat/backend-domain`. No commits, resets or changes to public pages/components/i18n were made for this task. Other agents' Task B edits in the shared tree were preserved, including their additions to AGENTS/todo.

## Behaviour

- Deposit/paid mutations, confirmed Stripe payments and handover issue persistent invoice snapshots through `OrderNotification`. The payment and invoice commit together; email runs through `NotificationService` asynchronously after commit.
- Every document gets a new consecutive number, references the order and previous invoice, and preserves its financial snapshot. The transactional counter rolls back with an aborted order mutation. Repeated financial/handover states do not issue again. Delivery locks the document and skips `sentAt` documents, so overlapping events/retries do not send it twice.
- Balance is actual `total - amountPaid`, never an inferred 50%. Handover alone does not collect money; an unpaid balance remains visible. A fully paid invoice has zero balance.
- Missing/failed SMTP leaves the document pending; retry runs every minute, up to 100 per pass, without allocating another number. A later QR form submission completes missing email recipients on pending documents. SMTP acceptance followed by a process crash before database commit remains an at-least-once delivery boundary; see deploy docs.
- German is the default because orders/customers store no locale. The renderer supports English. Text/plain and escaped text/html alternatives use the existing mail starter, without a PDF or new dependencies.
- Seller identity, address, UID/tax note and optional IBAN are configurable placeholders. No tax regime or company data was invented. Accounting archives outlive operational order cleanup; adviser approval of content and retention is still needed.
- Config returns `deliveryWindowStart`/`deliveryWindowEnd` (`HH:mm`). Track `when` and form `handoffs` keep `kind: 'vienna'` and gain delivery `fromHour`/`toHour` (18/20 by default); `untilHour` retains its market meaning. HTTP already passes typed JSON through, requiring no adapter edit. Types and mock expose the fields; UI rendering is owned by the separate UI agent.

## Files owned by Task A

Under `awg-tracking/src/main/java/com/artwithgab/awg_tracking/`:

- `config/AwgProperties.java`, `config/Bootstrap.java`
- `dto/shop/ShopConfigDto.java`, `dto/tracking/TrackWhenDto.java`
- New: `model/Invoice.java`, `model/InvoiceCounter.java`
- New: `repository/InvoiceRepository.java`, `repository/InvoiceCounterRepository.java`
- New: `service/InvoiceIssued.java`, `service/InvoiceRenderer.java`, `service/InvoiceService.java`
- `service/NotificationService.java`, `service/ShopService.java`, `service/ViewMapper.java`

Other backend files:

- `awg-tracking/src/main/resources/application.properties`
- New: `awg-tracking/src/main/resources/db/migration/V8__invoices.sql`
- New: `awg-tracking/src/test/java/com/artwithgab/awg_tracking/InvoiceApiTests.java`
- Tests: `NotificationServiceTests.java`, `ShopApiTests.java`, `StripeSignatureTests.java` in that same package.

Frontend contract only:

- `frontend/src/domain/types.ts`
- `frontend/src/api/mock/services.ts`, `frontend/src/api/mock/store.ts`

Deployment/docs:

- `docker-compose.yml`
- `docs/contracts-and-dtos.md`, `docs/deploy.md`, `docs/frontend-api-swap.md`, `docs/sprint5-contract.md`, this handoff
- Task A additions to shared `AGENTS.md` and `tasks/todo.md`

## Verified

From `awg-tracking/`:

```sh
./mvnw '-DargLine=-javaagent:/Users/andresbejarano/.m2/repository/net/bytebuddy/byte-buddy-agent/1.18.10/byte-buddy-agent-1.18.10.jar' test < /dev/null
```

**103 tests, zero failures/errors/skips.** Initial execution without the agent failed at Mockito self-attach in the sandbox; this is the AGENTS-documented workaround. Coverage includes deposit balance math, deposit→paid, handover, repeated state/webhook, multipart plain/HTML escaping and recipient, payment rollback (document and counter), missing host, late QR email completion, failed/repeated delivery, English rendering, market pickup/name surcharge, and the window in Track/form/config/invoice.

From `frontend/`:

```sh
VITE_DATA_SOURCE=http npm run build < /dev/null
npm run lint < /dev/null
node --test tests/*.test.mjs < /dev/null
```

Build passed; lint exited 0 with warnings in other files and all 26 staff CSS modules passed; Node **33/33 passed**. These checks ran in the shared working tree, including the other agent's then-current UI work.

From the repository root:

```sh
POSTGRES_DB=awg_check DB_USERNAME=awg_check DB_PASSWORD=placeholder PUBLIC_BASE_URL=https://example.com CORS_ORIGINS=https://example.com docker compose --env-file /dev/null config --quiet < /dev/null
git diff --check
```

Both passed. Compose validation used dummy values and did not start services or deploy.

## Open

- Configure owner/adviser-approved `INVOICE_BUSINESS_NAME`, `INVOICE_ADDRESS`, `INVOICE_UID`, `INVOICE_TAX_NOTE`, optional `INVOICE_IBAN`, and real SMTP. Validate invoice content/tax treatment and accounting retention with the adviser.
- Apply/verify V8 against PostgreSQL and test real SMTP acceptance/retry. Automated tests use H2 entity-generated schema without Flyway, as this repository requires.
- The separate UI agent must consume the window in public copy/calendars. No browser/E2E checks or independent cross-LLM audit were performed as part of Task A.
