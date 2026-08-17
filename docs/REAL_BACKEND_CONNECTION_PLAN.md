# Real Backend Connection Plan

## Objective

Replace demo state with tenant-scoped PostgreSQL persistence and real
authentication while preserving the existing user experience and domain rules.

## Architecture rule

UI components call typed route handlers or server actions. Each entry point
authenticates the viewer, resolves the company, validates input, authorizes the
operation, and invokes a transactional domain service. The browser cannot choose
its own trusted company identifier.

## Foundation

The repository contains a Prisma model and migrations, seed data, Supabase
helpers, role utilities, API handlers, domain services under
`src/lib/wia-control`, and demo providers that define expected interactions.

## Migration sequence

1. Provision separate development, pre-production, and production resources.
2. Configure secrets outside Git.
3. Generate Prisma Client and apply migrations in pre-production.
4. Seed non-sensitive data only outside production.
5. Configure Supabase authentication and company roles.
6. Replace each demo mutation with a validated, authorized API operation.
7. Re-read server state after mutations and keep optimistic UI reversible.
8. Add idempotency to booking, clock, webhook, and outbox operations.
9. Test role boundaries and tenant isolation.
10. Roll out modules behind explicit environment flags.

## Domain mapping

Customers and leads feed CRM; bookings and services feed operations; worksites
and shifts define planned coverage; clock events stay append-only; incidents and
corrections reference original evidence; billing and communications retain
provider identifiers and audit metadata.

## Assignment engine

The recommendation API loads candidates from the authenticated company, applies
hard constraints, stores policy version and score details, and records the
coordinator's decision. New models run in shadow mode before affecting work.

## Production prerequisites

Backups and restore tests, rollback strategy, structured logs, monitoring, rate
limits, privacy and retention policies, verified webhooks, retry handling,
secret rotation, browser and API QA, and an incident-response owner are required.
Demo mode and real mode must remain visibly separate and unable to share data.
