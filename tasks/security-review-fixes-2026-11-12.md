# Pre-release security fixes — 2026-11-12

**Status:** implementation completed locally; no commit, staging or deployment. `frontend/src` was not changed. Production checks and independent cross-model audit remain pending as specified below.

## Finding → files changed → tests

Backend Java paths below are relative to `awg-tracking/src/main/java/com/artwithgab/awg_tracking/`; test names are under `awg-tracking/src/test/java/com/artwithgab/awg_tracking/`.

| Finding | Files changed / resulting behavior | Tests |
|---|---|---|
| H1 verification | Existing `ShopService.checkout`, V10 and V8–V11 verified, not reimplemented or renumbered. Two pending checkouts per normalized e-mail or stored client IP hash, global cap, 15-minute reservation remain. | Existing `ShopApiTests.pendingLimitsApplySeparatelyToNormalizedEmailAndClientIp` and checkout expiry cases retained. |
| H2 mail relay | `service/TrackingService.java`, `FormService.java`: PENDING/REVIEW public writes reject 409 `PAYMENT_PENDING` before mutation/event; form GET reports non-editable. `OrderNotification.java` snapshots unconfirmed state. `NotificationService.java` suppresses all customer notifications for that state; address/form edits share one leading notification event/order/15 minutes, with no customer name in the edit greeting. | `SecurityReviewServiceTests`, `ShopApiTests.pendingAndReviewWebOrdersRejectPublicWritesWithStableCode`, `NotificationAbuseTests`; existing staff QR/form and paid-order address behavior retained. |
| M1 waitlist relay | `service/WaitlistQuota.java`, `ShopService.java`, `controller/ShopController.java`: 3/client/hour, 30 global/hour, 200 global/day. Resends consume the same budgets; confirmed/cooling-down addresses do not. Exhaustion is checked before address lookup to avoid revealing subscribers through 204/429 differences. | `WaitlistQuotaTests` (boundaries, hourly/day reset, IPv6 rotation), `WaitlistAbuseTests` (new/resend gating, no mail/mutation when rejected). |
| M2 memory bounds | `controller/ShopController.java`, `exception/PayloadTooLargeException.java`: no body binding, reject absent signature or oversized declared length before stream access, at most 256 KiB + 1 byte read before verification. `frontend/nginx.conf`: 64 KiB default, 60 MiB only for exact checkout and forms prefix; no other photo upload endpoints exist. `awg-tracking/Dockerfile`: 70% max heap, exit on OOM. | `WebhookBoundsTests` (missing/blank signatures, declared/unknown/understated sizes, raw UTF-8 signature verification), `ShopApiTests.oversizedWebhookReturnsStableTooLargeCode`; nginx static configuration assertions and JVM flag smoke check pass. |
| M3 IPv6 / enumeration | `security/RateLimiter.java`: shared /64 IPv6 keys, mapped IPv4 parity. `controller/PublicController.java`: shared 300 Track misses/hour; after exhaustion all lookups reject before consulting orders until the window expires. `docs/deploy.md`: manual owner Cloudflare rule and trust boundary. | `RateLimiterTests`, `PublicRateLimitTests`: rotated interfaces, global exhaustion, pre-lookup denial and exact one-hour recovery; successful lookups do not consume failure quota. |
| M4 staff lockout | `controller/AuthController.java`: failures scoped by account + client; retain client login budget. Account-wide 200/minute threshold only emits one warning, without account identity. | `PublicRateLimitTests`, adjusted `AuthApiTests`: other clients can still sign in after distributed failures. |
| L2 abandon | `service/ShopService.java`, `repository/OrderRepository.java`: scalar token check before schedule lock; absent/incorrect credentials and missing orders all no-op/204. Re-fetch the order under the lock to avoid pre-lock stale entity state. | `SecurityReviewServiceTests.unauthorizedAbandonDoesNotTakeScheduleLockOrRevealExistence`, adjusted `ShopApiTests.abandonReleasesThePendingCheckout`; paid-meanwhile behavior retained. |
| L3 metrics contention | `service/BuyMetricsService.java`, `model/ScheduleLock.java`, `config/Bootstrap.java`, new `V13__metrics_lock.sql`: metrics serialize on row 2, schedule retains row 1. | `BuyMetricsApiTests.concurrentMetricsDoNotWaitForScheduleLockOrLoseIncrements`: 12 concurrent increments complete with schedule locked, exact count retained. |
| L4 cleanup scan | `security/RateLimiter.java`: CAS-gated scan at most once/minute, using each bucket's duration. | `RateLimiterTests.cleanupScansAtMostOncePerMinuteAndRetainsLongerWindows`: over 50,000 keys, expired-key cleanup and hourly-key retention. |
| L5 SMTP logs | `service/NotificationService.java`: only exception class + numeric SMTP code, no recipient, reply, subject or throwable. `awg-tracking/pom.xml`: existing runtime Angus transport exposed as a direct compile dependency to inspect typed SMTP exceptions; version remains BOM-managed. | `NotificationAbuseTests.smtpFailuresLogOnlyExceptionClassAndNumericCodeForRegularAndInvoiceMail`: both SimpleMailMessage and invoice MIME failures redact recipient/reply and omit throwable. |
| L8 nginx image | **Reverted to `nginx:1.27-alpine` by Opus** (1.30 pull hangs locally; `nginx -t` passes on 1.27). Codex had set `nginx:1.30-alpine`, stable tag verified with the [official publisher](https://hub.docker.com/_/nginx). | Static Dockerfile review; container execution unavailable (Docker daemon not running). |

`docs/sprint5-contract.md` documents the security responses using existing `PAYMENT_PENDING`, `RATE_LIMITED`, `TOO_LARGE` codes. No existing error code was renamed. Deployment guidance is in `docs/deploy.md`.

## Validation

- Regression tests for unconfirmed writes and unauthorized abandon failed against the original code before implementation. The IPv6 prefix regression also failed before its fix.
- Final full requested Maven command, with startup Byte Buddy agent, passed: **162 tests, 0 failures, 0 errors, 0 skipped**. An earlier clean run removed an old compiled `zzscratch.StripeProbeTest` artifact; the final count reflects the current source suite. Track pre-lookup exhaustion/recovery and waitlist pre-lookup privacy checks are included.
- Commands (run in `awg-tracking/`):

```bash
./mvnw -q test -DargLine="-javaagent:$(find ~/.m2 -name 'byte-buddy-agent-*.jar' | head -1)"
./mvnw -q clean test -DargLine="-javaagent:$(find ~/.m2 -name 'byte-buddy-agent-*.jar' | head -1)"
```

- Local runtime: Java 25.0.1; Maven compilation target and container runtime remain Java 21. Docker daemon and nginx binary are unavailable here: no image build, `nginx -t`, container or deployment verification is claimed.
- `git diff --check` passed; no `frontend/src` diff. The worktree was clean before this task. A concurrent `frontend/e2e/keyboard-availability.spec.ts` change appeared during execution and was left untouched; it is outside this security fix. No commit or staging was attempted.

## Independent audit and remaining deployment work

The project requires a reviewer from another model family. Both read-only audit attempts failed before producing findings: Vibe/GLM-5.3 failed to initialize its app server; Antigravity/Gemini failed to bind its localhost port (`Operation not permitted`). No independent audit approval is claimed. Run that audit outside this sandbox before release.

Owner/deployer still needs to apply the documented Cloudflare Track rule, run V13 on PostgreSQL, rebuild/start containers and verify nginx limits plus real SMTP/Stripe flows. Existing SMTP and production payment verification tasks remain open. In-memory rate/mail budgets are for one backend instance, reset at restart and need a shared store before horizontal scaling.
