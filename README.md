# PipelineIQ SaaS

PipelineIQ is the primary multi-tenant SaaS product for lead intake, follow-up workflow, governed SMS automation, booking, and operations visibility.

This repository is the **source of truth** for the SaaS implementation (Next.js web app + worker service).
GoldBot in this repo is an internal/experimental automation module name kept for compatibility.
Legacy Tauri/Rust GoldBot code is not part of this tree.

## Architecture

- `apps/web/`: Next.js App Router dashboard, server actions, API routes
- `apps/worker/`: durable job runner, state machine, governor, action gateway, provider adapters
- `supabase/migrations/`: Postgres schema and migration history
- `apps/web/lib/goldbot.ts`: org-scoped data access + dashboard queries for the PipelineIQ workflow (module name retained for compatibility)

Core flow:

1. Lead intake or inbound webhook writes domain rows.
2. Durable job is enqueued in `jobs`.
3. Worker evaluates state machine actions.
4. Governor validates each action (kill switch, consent, business hours, throttles, automation mode).
5. Action gateway performs writes/external calls and records `audit_log` rows.

## Prerequisites

- Node.js 20+
- npm 10+
- Postgres (Supabase or compatible)
- Clerk account
- Stripe account
- Twilio account (for real SMS)

## Environment Setup

Create local env files:

```bash
cp apps/web/.env.example apps/web/.env.local
cp .env.worker.example apps/worker/.env.local
```

For local development that mirrors Production values, pull env from Vercel:

```bash
npm run env:pull
```

Validate env before starting/building:

```bash
npm run env:check
```

`apps/web/.env.local` is gitignored.

Required web keys (`apps/web/.env.example`):

### Web (`apps/web/.env.local`)

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

Optional:

- `DEV_USER_ID` (local fallback when Clerk is not configured)
- `NEXT_PUBLIC_ENABLE_EXPERIMENTAL_GOLDBOT` (`true` exposes experimental GoldBot nav/pages; default hidden)
- `TWILIO_VERIFY_SIGNATURE`
- `TWILIO_WEBHOOK_URL`
- `REDIS_URL` (used by readiness checks / cache integrations)
- `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE`

### Worker (`.env.local` or worker env)

- `DATABASE_URL` (or `WORKER_DATABASE_URL`)
- `REDIS_URL` (optional cache health check)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` (for real SMS)
- `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `SENTRY_RELEASE` (optional)

Booking provider vars (Google Calendar adapter):

- `BOOKING_PROVIDER=google_calendar` (or `none`)
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_IMPERSONATED_USER` (optional)

## Database Setup

Run Supabase migrations (recommended) so web and worker schema match:

- `supabase/migrations/202602230001_goldbot_v1.sql`
- `supabase/migrations/202602230002_goldbot_prod_readiness.sql`

Then seed local demo data:

```bash
npm --prefix apps/worker run seed
```

Seed creates:

- demo org + main location
- owner membership
- demo lead + conversation
- starter `lead_created` job

## Run Services

Install dependencies:

```bash
npm install
npm --prefix apps/worker install
```

Run web app:

```bash
npm run dev
```

Build (includes env validation via `npm run env:check`):

```bash
npm run build
```

Run worker:

```bash
npm run worker:dev
```

Run both:

```bash
npm run dev:all
```

## Docker Compose

Build and run web + worker + Postgres + Redis:

```bash
cp .env.docker.example .env
docker compose up --build
```

The compose stack is variable-driven (`${...}`), so environment-specific values can be provided via `.env` or shell variables.

## Clerk Configuration

1. Create a Clerk app.
2. Configure env keys in `.env.local`.
3. Enable Organizations in Clerk.
4. Use an active organization in the UI; app access is scoped to org membership (`owner` vs `staff`).
5. Owner-only controls: kill switch + automation settings.

## Supabase Configuration

1. Create a Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `DATABASE_URL` to your Postgres connection string.
4. Apply migrations before running worker/web.

## Stripe Configuration

1. Create a recurring Pro price in Stripe.
2. Set `STRIPE_PRO_PRICE_ID`.
3. Set `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Add webhook endpoint for `/api/webhook/stripe` and set `STRIPE_WEBHOOK_SECRET`.

## Twilio Configuration

- Webhook endpoint: `/api/webhook/twilio`
- In production, keep `TWILIO_VERIFY_SIGNATURE=true`.
- Set `TWILIO_WEBHOOK_URL` to the publicly reachable URL used by Twilio for signature validation.

## Booking Provider Integration

The worker supports booking via provider adapter:

- `none`: simulated provider response (safe local default)
- `google_calendar`: real event insert with deterministic idempotent event IDs

Location-level settings in `/dashboard/settings/automation` control:

- `autonomy_mode` (internal key): `suggest_only` or `safe_auto`
- `booking_provider`
- `booking_settings_json`

## Tests and Validation

Run checks:

```bash
npm run lint
npm run typecheck
npm run worker:typecheck
npm run worker:test
```

Notes:

- Some worker integration tests skip automatically when Postgres env is unavailable.
- Unit coverage includes governor edge cases, action-gateway idempotency, and retry/dead-letter behavior.

## Health Checks

- Web liveness: `GET /api/health/live`
- Web readiness: `GET /api/health/ready`
- Worker liveness: `GET /health/live` (on `WORKER_HEALTH_PORT`)
- Worker readiness: `GET /health/ready` (on `WORKER_HEALTH_PORT`)

Readiness checks validate database connectivity and Redis availability (when `REDIS_URL` is configured).

## Error Reporting (Sentry)

Set `SENTRY_DSN` (and optionally `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`) to enable server/worker error forwarding to Sentry.

## CI/CD and Deployment

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

1. Lint + typecheck + tests
2. Docker image build
3. Deploy to Google Cloud Run on push to `main`

Required deployment configuration:

- Secret: `GCP_SA_KEY`
- Repo vars: `GCP_PROJECT_ID`, `GCP_REGION`, `CLOUD_RUN_SERVICE`
- Optional repo vars: `GCP_ARTIFACT_REPOSITORY`, `DEPLOY_IMAGE_NAME`, `CLOUD_RUN_ENV_VARS`

## Database Backups

- Script: `scripts/backup-db.sh`
- Schedule: `.github/workflows/db-backup.yml` (daily)
- Storage target controlled by vars:
  - `BACKUP_PROVIDER` (`gcs` or `s3`)
  - `BACKUP_BUCKET`
  - `BACKUP_PREFIX` (optional)

## Operational Dashboard + Export

Dashboard includes:

- queued/running/dead job counts
- recent send failures
- recent opt-out events
- outbound heatmap (last 7 days)

Audit export:

- `GET /api/audit/export?limit=5000` (CSV)
- includes policy version, decisions/results, and timestamps
