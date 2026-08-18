# WIAControl

WIAControl is a multi-tenant SaaS operations platform for service businesses.
Its core connects worksites, planned shifts, time tracking, incidents, and
staffing replacements. The CRM remains an optional secondary sales module.

The application is built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui,
Supabase, PostgreSQL, Prisma ORM, and Stripe Subscriptions.

## Modules

- Operations coverage: daily shifts, critical gaps, and live status.
- Assisted replacements: recommends the best available employee and records
  the coordinator's final decision.
- Time tracking: clock-in, clock-out, breaks, method, and worksite.
- Incidents and corrections: retains the original record and stores every
  review and resolution separately.
- Employee area: mobile clocking with point-in-time verification and no
  continuous tracking.
- Worksites and shifts: creation, editing, archiving, daily/weekly planning,
  and overlap checks.
- Authentication with Supabase: sign-in, registration, password recovery, and roles.
- Business overview: revenue, services, customers, leads, invoices, and team.
- Optional CRM: pipeline, profiles, history, notes, and follow-up.
- Services: recurring and one-time work, statuses, and employee assignment.
- Calendar: week/month views and drag-and-drop scheduling.
- Payments: Stripe Checkout, Billing Portal, and failed-payment alerts.
- Automations: reminders, confirmations, follow-up, and review requests.
- Customer portal: services, invoices, requests, and documents.

## Project structure

```text
src/app
  (auth)              Authentication flows
  (dashboard)         Internal platform
  api                 Route handlers
  booking             Public booking experience
  employee            Mobile employee experience
src/components
  calendar            Drag-and-drop scheduling
  control             Coverage, time tracking, and employee experience
  crm                 Sales pipeline
  dashboard           KPIs and charts
  layout              Responsive SaaS shell
  payments            Stripe actions
src/lib
  auth                Roles and permissions
  assignment          Explainable assignment engine
  supabase            Supabase clients
  wia-control         Domain and transactional services
prisma/schema.prisma  Multi-tenant PostgreSQL model
```

## Local development

The repository supports a local demo through `NEXT_PUBLIC_DEMO_MODE=true`.

```bash
npm install
npm run prisma:generate
npm run dev
```

The application is available at `http://localhost:3000`.

Public routes:

- `/employee` — employee clocking experience.
- `/booking` — public service booking form.
- `/portal` — customer portal.

Internal routes:

- `/control` — live operations coverage.
- `/worksites` — worksite management.
- `/shifts` — shift planning.
- `/time-tracking` — clock events, incidents, and corrections.
- `/settings` — company policies and optional modules.

The implementation roadmap is available in
[`docs/WIACONTROL_PRODUCT_ROADMAP.md`](docs/WIACONTROL_PRODUCT_ROADMAP.md).
The developer delivery guide, including the practical implementation sequence
and acceptance demonstrations, is in
[`docs/WIACONTROL_IMPLEMENTATION_PLAYBOOK.md`](docs/WIACONTROL_IMPLEMENTATION_PLAYBOOK.md).

## Database

Configure `DATABASE_URL` with a PostgreSQL instance, then run:

```bash
npm run db:migrate:deploy
npm run db:seed
```

The schema includes companies, users, roles, worksites, shifts, clock events,
incidents, corrections, customers, services, CRM, billing, automations,
communication outbox, and audit history. Clock events are append-only.

## Environment variables

```text
DATABASE_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_DEMO_MODE
DEMO_MODE
DEMO_ROLE
NEXT_PUBLIC_CRM_ENABLED
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_STARTER
STRIPE_PRICE_GROWTH
STRIPE_PRICE_SCALE
```

## Quality checks

Run the full verification before publishing:

```bash
npm run quality
npm run build
npm audit --omit=dev
```

The project is prepared for Vercel deployment with Supabase/PostgreSQL and
Stripe connected through environment variables.
