# WIAControl Pre-production Guide

## Expected result

A correct installation starts with the CRM disabled, requires authentication,
isolates every request by company, and supports this flow:

1. Create a worksite and shift.
2. Assign or recommend an employee without overlaps.
3. Clock in, start/end a break, and clock out.
4. Detect and resolve an incident.
5. Request and review a correction.
6. Export the record and inspect the audit trail.

## Requirements

- Node.js 22.22 or later on the Node 22 LTS line.
- PostgreSQL with an empty database or verified backup.
- Supabase project with authentication configured.
- Stripe test mode only when billing is enabled.
- HTTPS for every environment accessible outside the local machine.

## Environment

Start from `.env.example` and keep secrets separate per environment:

```text
NEXT_PUBLIC_DEMO_MODE=false
DEMO_MODE=false
NEXT_PUBLIC_CRM_ENABLED=false
NEXT_PUBLIC_APP_URL=https://preproduction.example.com
```

Never commit `DATABASE_URL`, Supabase keys, or Stripe secrets.
`SUPABASE_SERVICE_ROLE_KEY` must exist only on the server.

## Deployment sequence

```bash
npm ci
npm run prisma:generate
npm run preprod:verify
npm run db:migrate:deploy
```

Run the seed once, only for a new demonstration or pre-production environment:

```bash
npm run db:seed
```

Do not publish with `prisma db push`. Migrations are the reproducible record of
structural changes.

## Post-deployment checks

- `GET /api/health` returns `200`, production mode, reachable database, and
  configured authentication.
- An employee cannot open the coordinator dashboard.
- A coordinator cannot access another company by changing an ID.
- Duplicate idempotency keys create only one clock event.
- PostgreSQL rejects `UPDATE` and `DELETE` on `ClockEvent`.
- Replacement confirmation creates the decision, assignment, resolution, audit,
  and outbox message in one transaction.
- CRM routes remain unavailable when `crmEnabled=false`.

## Time tracking and company responsibility

WIAControl includes start/end events, breaks, traceability, separate corrections,
exports, and configurable retention. Technical configuration does not replace
consultation with employee representatives, the applicable collective agreement,
data-protection policy, or qualified legal review. Before enabling location checks,
the company must document their necessity, information, and limits. WIAControl
requests location only when clocking and never tracks continuously.

## Backup, recovery, and rollback

1. Create and verify a PostgreSQL backup before `migrate deploy`.
2. Keep the previous application version during the change window.
3. If the application fails without a data change, roll back the application.
4. If a migration fails, stop writes and add a corrective migration; never edit an
   already executed migration.
5. Restore a backup only after evaluating later data loss.
6. Recheck `/api/health`, one clock event, and one export.

Clock events are append-only and must never be repaired with manual SQL. Use the
correction workflow to retain original evidence.

## Operations and observability

- Every API response includes `X-Request-Id`.
- Unexpected errors are logged as JSON without request bodies or personal data.
- The outbox connects email, SMS, or WhatsApp without adding providers to the
  coverage transaction.
- Configure external alerts for `5xx` health responses and `FAILED`
  `CommunicationOutbox` messages.

## Final gate

```bash
npm run preprod:verify
```

The command requires warning-free lint, correct types, passing tests, a valid Prisma
schema, a production build, and a clean production dependency audit.
