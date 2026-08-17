# Pre-production Setup

## Objective

Create an isolated environment that behaves like production without live
customer data or payment credentials.

## Environment

Use a reviewed branch and dedicated deployment. Keep development,
pre-production, and production projects, databases, keys, and webhook endpoints
separate. Configure the values documented in `.env.example` through the hosting
platform; never commit secrets.

## Database

```bash
npm install
npm run prisma:generate
npm run db:migrate:deploy
npm run db:seed
```

Use seed data only outside production. Verify clean-database migration and
document rollback or forward-fix procedures.

## Authentication and roles

Configure Supabase redirects for the pre-production domain. Create test accounts
for platform administrator, company administrator, coordinator, and employee.
Confirm that disabled users, cross-company access, and unauthorized mutations
are rejected server-side.

## Stripe test mode

Create test prices and the pre-production webhook. Exercise checkout,
cancellation, failed payment, and duplicate webhook delivery. Never use live
Stripe keys in this environment.

## Verification

```bash
npm run quality
npm run test:coverage
npm run build
npm audit --omit=dev
```

Also verify health checks, redirects, tenant isolation, core routes, one complete
clock-incident flow, one replacement decision, mobile clocking, webhook logs,
backups, and error alerts.

## Preserve the local demo

Pre-production work must not remove the offline-friendly demo. Demo and real
modes must be explicit, visibly distinguishable, and unable to share data.
