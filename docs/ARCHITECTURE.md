# Architecture

## Principles

- Multi-tenancy starts in the data model: every operational entity belongs to a `Company`.
- Authentication is delegated to Supabase Auth; authorization uses internal roles.
- Prisma ORM runs on PostgreSQL to keep the domain typed and migratable.
- Stripe handles subscriptions, the billing portal, and webhooks.
- The SaaS interface is modular, responsive, and dark by default.

## Roles

- `SUPER_ADMIN`: platform management, MRR, churn, companies, and users.
- `ADMIN`: full administration of one company.
- `MANAGER`: operational and sales management.
- `EMPLOYEE`: operational access to assigned services.

## Main routes

- `/dashboard`
- `/crm`
- `/crm/[customerId]`
- `/services`
- `/calendar`
- `/employees`
- `/invoices`
- `/payments`
- `/automations`
- `/portal`
- `/admin`

## Prepared integrations

- Supabase Auth and PostgreSQL.
- Google Calendar through the calendar module.
- Stripe Checkout, Billing Portal, and webhooks.
- Email/SMS automations through persisted rules.
