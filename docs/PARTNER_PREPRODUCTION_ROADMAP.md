# Partner Pre-production, Backend, and Integrations Roadmap

## Objective

Turn the local WIAControl experience into a secure, observable pre-production
system connected to real infrastructure while preserving demo mode.

## Working rules

Work on a reviewed branch. Do not commit secrets, use live customer data, rewrite
existing clock evidence, bypass server authorization, or mix demo and real data.
Coordinate changes to schema, migrations, API contracts, authentication, and
billing. Record assumptions and validation evidence.

## Phase 1: Environment

Install dependencies, verify the supported runtime, generate Prisma Client, and
run the existing quality gate. Create separate Supabase/PostgreSQL, deployment,
and Stripe test resources for pre-production.

## Phase 2: Configuration

Populate hosting secrets from `.env.example`. Verify that missing required
variables fail clearly and that server-only credentials never reach the client.

## Phase 3: Database

Apply migrations to a clean database, seed a sample company, users, employees,
worksites, shifts, clock events, incidents, and recommendations, then verify
tenant-scoped reads and writes. Document rollback or forward-fix procedures.

## Phase 4: Authentication and roles

Configure redirects and test platform administrator, company administrator,
coordinator, and employee accounts. Test unauthorized, disabled-user,
wrong-company, expired-session, and direct-API cases.

## Phase 5: Real APIs

Connect coverage, employees, worksites, shifts, clock events, incidents,
corrections, settings, exports, recommendations, and communications to the
database through validated domain services. Add transactions and idempotency.

## Phase 6: Stripe test mode

Configure products, prices, Checkout, Billing Portal, and signed webhooks. Test
success, cancellation, failure, retries, and duplicate delivery without live keys.

## Phase 7: Deployment

Deploy pre-production, apply migrations, verify health and logs, and traverse
authentication, control, employee, booking, time tracking, settings, CRM, and
billing. Check desktop and mobile layouts.

## Phase 8: Technical report

Deliver the deployment URL, commit reference, migration status, configured
providers, test evidence, known limitations, monitoring links, rollback steps,
and named owners. Pre-production is ready only when core stories work with real
persistence and failures are observable and recoverable.
