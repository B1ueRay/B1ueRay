# Validation record

Validated in the supplied cloud workspace on 2026-10-06. At the time of this validation, source changes were local and no Git commit, push or public deployment had been performed. Subsequent Windows packaging adds only a launcher and documentation; application behavior is unchanged.

- Node 24.19.0, Next.js 16.4.0, Prisma 7.10.0, PostgreSQL 17.
- Frozen dependency installation (`npm ci`), Prisma generation, migration deployment and idempotent seed passed both natively and in Docker.
- Three SQL migrations applied to a fresh Compose database. Seed created eight fictional adult creators, 24 safe posts, legal documents and four demo accounts. Demo age state is `SELF_DECLARED`, not identity verified.
- TypeScript, ESLint with zero warnings, Prettier and production standalone build passed.
- Vitest: 39 passed (20 domain and 19 database integration tests) against a separate test database.
- Playwright: six desktop/mobile scenarios passed against native production startup. The same suite also validates the fresh Docker Compose deployment: registration, subscription, PPV, chat, paid-message access, staff editing, generation review, moderation, audit, role protection, CSRF and webhook signature checks.
- Both Docker tools and runtime images built with TLS verification and lockfile integrity checks enabled. Compose init exited successfully; PostgreSQL and web health checks passed. Native and Compose `/api/health` endpoints confirmed database connectivity.
- The reusable `scripts/cloud-install.sh` was executed successfully: it preserved the local environment file, installed dependencies, generated Prisma, started PostgreSQL, migrated and seeded.
- Production dependency audit: zero vulnerabilities. Development tooling has five high-severity findings associated with the upstream `braces` recursion advisory; see `docs/security.md`. No unsupported dependency replacement or check suppression was used to conceal them.
- `git diff --check` passed; the original `index.html` remains unchanged. Secrets, databases, generated private media and build/test outputs are excluded from source tracking.

No external payment, AI, email, identity-verification or storage provider was exercised. Local providers are intentionally deterministic mocks. No money was charged. Database/media volumes need independent backups. These checks establish a working development MVP, not production readiness or legal approval.
