# VELORA

A runnable, production-oriented **development MVP** for premium fictional adult AI creators. Original branding, luxury dark UI, safe vector artwork, real PostgreSQL persistence, and deterministic local AI/payment providers. It is **not approved for a live adult business** and does not perform identity verification or charge money.

The previous profile README is preserved in `docs/original-profile.md`; the previous standalone demo remains in `index.html`.

## Quick start — Docker

**Windows:** follow the [step-by-step Russian guide](docs/windows.md). The PowerShell launcher creates local secrets and starts the complete application without installing Node.js separately.

Requirements: Docker with Compose v2. No paid API credentials are needed.

```sh
git clone https://github.com/B1ueRay/B1ueRay.git
cd B1ueRay
cp .env.example .env
# Replace the three secret placeholders with independent random 32+ character values.
# Alternatively, with Node 24 installed, use `npm run setup:env` instead of copying.
docker compose up --build
```

Open localhost port **3000** in your browser. Compose starts PostgreSQL and Redis, runs the real migrations and idempotent seed in an init container, then starts the production standalone Next.js server. Containers run application code as a non-root user. Database and private media use named volumes. `POSTGRES_PORT` and `WEB_PORT` can change host ports; when changing the web port, also change `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`.

Never deploy the default local database password or demo accounts. Named Docker volumes require separate backups and are not guaranteed to be part of a Codex workspace snapshot. Do not run `docker compose down -v` on data you want to preserve.

## Development with Node

Requirements: Node **24 LTS**, npm, Docker (or an existing PostgreSQL 17 database).

```sh
npm ci
npm run setup:env          # creates .env only if absent; generates secrets without printing them
npm run db:generate
docker compose up -d db redis
npm run db:migrate
npm run db:seed
npm run dev
```

The native app connects to the `DATABASE_URL` in `.env`, normally localhost:5432. Compose uses its own internal `db` hostname. Stop an existing service on ports 3000/5432 or choose alternate ports before startup. A read-only Docker config directory in a managed cloud runner can be handled with `DOCKER_CONFIG=/tmp/velora-docker` for Docker commands. For enterprise/cloud proxy networks, `DOCKER_CONFIG=/tmp/velora-docker npm run docker:build` passes existing proxy settings, resolves the proxy hostname for BuildKit, and mounts the supplied public CA bundle as an ephemeral build secret. It preserves TLS and npm integrity verification; then use `docker compose up -d --no-build`. Ordinary local Docker builds need no custom CA.

For local production startup:

```sh
npm run build
npm start
```

`npm start` copies public/static assets into the generated standalone output, then runs its server. Do not run `next build` concurrently with `next dev`, since they write the same `.next` directory. Health check: `GET /api/health` verifies a database query.

## Demo accounts

| Role            | Email                 | Password        |
| --------------- | --------------------- | --------------- |
| Member          | member@velora.test    | VeloraDemo!2026 |
| Admin           | admin@velora.test     | VeloraDemo!2026 |
| Creator manager | manager@velora.test   | VeloraDemo!2026 |
| Moderator       | moderator@velora.test | VeloraDemo!2026 |

Accounts are seeded only when `DEMO_MODE=true`. Demo accounts have `SELF_DECLARED` age state, not verified identity. New members sign up normally, confirm adulthood, and accept current legal documents. No membership is pre-purchased. Seed preserves existing profiles/prices/user changes and can be rerun safely.

## Implemented product

- Responsive homepage, directory/search/category/language/sort filters, original adult AI profiles, preview/subscriber/PPV posts and clear AI disclosures; 8 fictional creators, 24 safe posts.
- Better Auth email/password, hashed passwords, database sessions, password changes with session revocation, reset/verification delivery architecture, optional social-provider configuration. Demo emails are in a private database development inbox, never sent externally.
- Membership purchase/expiry/manual renewal/cancellation; PPV and paid-note purchases; bounded tips; moderated paid custom requests with reviewed private asset delivery; declined-payment simulation; admin refunds with access revocation.
- Server-derived prices, central entitlements, verified payment settlement, transactionally balanced integer-cent ledger, signed webhooks, unique event IDs, advisory locks and idempotency.
- Favorites, deterministic discovery recommendations (interests/languages/subscriptions/purchases/chat/recent views), followed-creator feed with cursor pagination, notifications, purchase history, settings, conversation deletion, memory controls, private export and deletion-review requests.
- Private AI chat with moderation, persona/history/memory context, mock replies, configurable paid offers, paid attachments/neutral voice architecture, token usage accounting and tip events.
- Staff studio: metrics, creator/pricing/category/tag settings, content-library filters, drafts/scheduled/public/subscriber/PPV posts, generation queue/review, paid messages, requests, reports, takedowns, suspension/bans, refunds and audit records. Manager/moderator/admin capabilities are checked server-side.
- Legal version/acceptance records, 18+ self-declaration separate from verified age, configurable jurisdiction checks, upload validation contract, AI labeling and moderation/audit foundations.

## Architecture and directories

| Directory        | Responsibility                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `src/app`        | App Router pages and thin authenticated HTTP adapters                                        |
| `src/components` | Shared responsive design, paywalls, dialogs, chat, staff forms                               |
| `src/lib`        | Prisma connection, Better Auth, RBAC, CSRF, age tokens, upload validation, brand             |
| `src/services`   | Payments/ledger, entitlements, chat orchestration, generation, recommendations, metrics      |
| `src/providers`  | Payment, LLM, moderation, image/video/voice, storage, cache/queue/age-verification contracts |
| `prisma`         | 40+ models, real SQL migrations, constraints/indexes, idempotent seed                        |
| `public/media`   | Public original SFW creator portrait placeholders only                                       |
| `.storage`       | Ignored private seed/generated media; never mounted as public content                        |
| `tests`          | Domain tests, isolated PostgreSQL integration tests, desktop/mobile browser flows            |
| `scripts`        | Safe local env initialization, isolated test database runner, standalone startup             |
| `docs`           | Architecture, security notes, validation evidence, original profile text                     |

Public pages receive only safe post views. Locked bodies and media IDs are withheld. `/api/media/:id` requires a valid server-signed adult declaration and evaluates current entitlement on every request; responses are `private, no-store`. Knowing a storage key or media ID does not grant access. Privileged review endpoints separately enforce staff roles. Export excludes unpaid locked message bodies. Internal prompts and persona metadata do not go to member clients.

Money is EUR integer cents. Settlement adds a balanced journal: negative gross debit, positive creator allocation, processor fee, tax placeholder and net platform revenue. Refunds write inverse entries. This is accounting infrastructure, **not a prepaid stored-value wallet**. The demo allocates 20% platform fee and 3% processor fee; connect actual approved-provider fee/tax rules before commerce launch.

## Configuration

| Variable                                                             | Purpose                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                       | PostgreSQL connection, required                                                                                                                               |
| `BETTER_AUTH_SECRET`                                                 | Independent random authentication secret, required                                                                                                            |
| `BETTER_AUTH_URL`                                                    | Exact public origin; also trusted origin/CSRF origin                                                                                                          |
| `NEXT_PUBLIC_APP_URL`                                                | Public application origin configuration                                                                                                                       |
| `MEDIA_SIGNING_SECRET`                                               | Signs age-declaration cookies, required; protected media is authenticated, not publicly signed                                                                |
| `PAYMENT_WEBHOOK_SECRET`                                             | HMAC-SHA256 mock webhook verification, required                                                                                                               |
| `DEMO_MODE`                                                          | Enables mock charges, demo users and development email inbox                                                                                                  |
| `STORAGE_PATH`                                                       | Private filesystem storage root; default `.storage`                                                                                                           |
| `BLOCKED_COUNTRIES`                                                  | Comma-separated uppercase ISO country codes                                                                                                                   |
| `TRUST_COUNTRY_HEADER`                                               | Accept `x-verified-country` only behind a proxy that removes incoming client headers and injects trusted geographic evidence                                  |
| `REDIS_URL`                                                          | Reserved Redis adapter destination; not used by current in-process adapters                                                                                   |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                           | Optional Google social adapter credentials (Better Auth); provider callback must be registered                                                                |
| `FREELLMAPI_BASE_URL`, `FREELLMAPI_API_KEY`                          | Optional LLM for creator chat via [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) or any OpenAI-compatible `/v1` endpoint; empty keeps mock replies |
| `FREELLMAPI_MODEL`, `FREELLMAPI_TIMEOUT_MS`, `FREELLMAPI_MAX_TOKENS` | Model id (default `auto`, router picks), request timeout (default 25000 ms), reply token cap (default 400)                                                    |
| `TEST_DATABASE_URL`                                                  | Optional isolated integration database; name must contain `velora_test`                                                                                       |
| `E2E_BASE_URL`, `CHROMIUM_PATH`                                      | Browser-test target and Chromium executable                                                                                                                   |

Jurisdiction checks fail closed if restrictions are configured without trusted country evidence. Directly enabling header trust on a publicly reachable server permits header forgery; configure the edge before using this feature. With `DEMO_MODE=false`, mock charging refuses service and real transactional email must be implemented before signup verification works. No real payment, AI, S3 or age-provider credentials are currently consumed. Implement approved adapters, then add their own securely injected credentials. Never put secrets in Git.

## LLM chat via FreeLLMAPI

Creator chat uses the deterministic mock unless an OpenAI-compatible endpoint is configured. [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) routes requests across free tiers of many providers (Groq, Google, Cerebras, OpenRouter, …) behind one `/v1` API.

1. Set `FREELLMAPI_ENCRYPTION_KEY` in `.env` (`openssl rand -hex 32`) and start the router: `docker compose --profile llm up -d freellmapi`.
2. Open http://localhost:3001, create the admin account, add at least one provider key on the **Keys** page and copy the unified API key.
3. In `.env` set `FREELLMAPI_BASE_URL=http://freellmapi:3001/v1` (inside Compose; use `http://localhost:3001/v1` for `npm run dev`) and `FREELLMAPI_API_KEY=<unified key>`, then `docker compose --profile llm up -d`.

Replies still pass the moderation policy in both directions. If the router fails or times out, the chat falls back to a mock reply and logs the error; the provider and model are stored on each message (`freellmapi:<model>` or `mock`).

## Payments and webhooks

Member mutations use `POST /api/actions`; staff mutations use `POST /api/admin`. Both require an authenticated active adult account, same-origin requests, validated bodies and server permissions. Webhooks intentionally use signature authentication rather than browser CSRF.

Mock callback endpoint: `POST /api/webhooks/payment`. `x-payment-signature` is a hex HMAC-SHA256 of the **raw JSON bytes** with `PAYMENT_WEBHOOK_SECRET`.

```json
{
  "eventId": "unique-provider-event",
  "paymentId": "opaque-payment-id",
  "status": "PAID",
  "reference": "mock_<paymentId>",
  "amount": 1499,
  "currency": "EUR"
}
```

The mock provider settles synchronously in the local checkout path. A callback is reconciled against server amount/currency/reference; an event never grants access from a client success flag. Duplicate events cannot duplicate ledger entries. Production adapters must use provider-native idempotency, durable webhook retry, signed provider callbacks and reconciliation jobs.

## Tests

```sh
npm run typecheck
npm run lint
npm test                    # creates isolated velora_test database, migrates/seeds, runs unit + integration tests
npm run test:unit           # no database required
npm run build
npm start                   # separate terminal; browser tests use a running application
npm run test:e2e
npm run format:check
npm audit --omit=dev
```

The test DB runner needs a local PostgreSQL role with `CREATEDB`, or provide an existing isolated `TEST_DATABASE_URL`. It does not reset/delete the development database. Browser tests create unique users, demo purchases, jobs and moderation records in the database behind the running app. The E2E process `DATABASE_URL` must point to that same database. On systems without `/usr/bin/chromium`, set `CHROMIUM_PATH` to your installed browser (or run `npx playwright install chromium` and set its executable path).

See `docs/validation.md` for commands actually exercised and `docs/security.md` for boundaries and remaining risks.

## Current limitations

This is a coherent working MVP, not a production launch authorization. Mock moderation is a conservative English keyword policy over safe generated placeholders, not a comprehensive safety classifier. The LLM is deterministic unless FreeLLMAPI is configured; media is original SFW vector art, not photorealistic content. Mock voice is a neutral tone. Video generation intentionally fails with a stored diagnostic. Generation is processed synchronously with database lifecycle records; external queues/Redis adapters and crash recovery are future work. No uploads are exposed publicly; MIME/size/filename validation is supplied for future adapters.

Subscriptions renew manually; there is no automatic billing, tax calculation or payout system. Scheduled posts become visible at the scheduled time through request-time filtering, but scheduled notifications need a worker. Current cancellation-intent/MRR metrics are explicitly simplified. Community interactions/external creator onboarding are not enabled; consent records and blocked-user storage are groundwork. Account deletion is an audited review request, not an unattended purge. Long-term summarization, S3 storage, push/email delivery and formal verified age assurance require real adapters. Auth brute-force limiting is in-process; member action limits use atomic PostgreSQL counters. Configure shared auth limits at the gateway before multi-instance deployment.

## Next ten priorities

1. Complete jurisdiction-specific legal review, real age-assurance integration and edge enforcement.
2. Integrate an approved payment processor; test signed callbacks, retries, renewal, tax and refunds in its sandbox.
3. Replace mock moderation with audited text/image/video classifiers plus trained human review.
4. Connect approved LLM/media providers with cost ceilings, timeouts and structured output validation.
5. Move generation, scheduled notifications and reconciliation to durable workers/Redis queues.
6. Implement private S3 storage, short-lived authorized delivery and quarantine/transcoding pipelines.
7. Ship real verified email, recovery delivery and optional social login/MFA, with shared anti-abuse controls.
8. Complete data-deletion operations, privacy request service levels, retention policies and backups.
9. Expand accounting with configurable actual processor fees/taxes, revenue cohorts, payouts and historical churn.
10. Add operational telemetry, load tests, accessibility audit, independent security review and CI/CD release gates.
