# Local Customer Demo

## Start

```bash
npm install
npm run prisma:generate
npm run build
npm run demo:start
```

Open `http://127.0.0.1:3000`. Use `npm run dev` during development. The local
experience uses `NEXT_PUBLIC_DEMO_MODE=true` when backend services are absent.

## Route sequence

1. `/login` and `/dashboard` for access and context.
2. `/control` for coverage and assisted replacements.
3. `/booking` for the public customer request.
4. `/crm`, `/services`, and `/calendar` for commercial and planning follow-up.
5. `/employees`, `/worksites`, and `/shifts` for operational setup.
6. `/employee` and `/time-tracking` for clocking, incidents, and corrections.
7. `/invoices`, `/payments`, `/automations`, and `/portal` for follow-through.

## Demo data

Demo mode uses sample records and session state without external credentials.
Reset the page or browser session for a clean story. Never describe local
mutations as persisted production records.

## Mobile view

```bash
npm run demo:mobile:employee
npm run demo:mobile:booking
```

Demonstrate point-in-time location verification, clock-in, breaks, clock-out,
and privacy messaging. WIAControl does not continuously track employees.

## Checklist

- Run lint, type checking, tests, and the production build.
- Start from clean browser state and check the console.
- Verify desktop and mobile widths.
- Confirm the sample company and role.
- Rehearse a complete coverage-gap decision.
- Identify simulated and connected integrations honestly.
