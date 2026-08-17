# WIAControl: Initial Product Scope

## Value proposition

WIAControl goes beyond recording clock-in and clock-out. Its advantage is closing
the complete operational loop:

1. Detect an uncovered shift or missing clock event.
2. Find a compatible replacement by availability, area, and skills.
3. Explain the recommendation to the coordinator.
4. Confirm coverage in one action.
5. Retain the decision, assignee change, and time events.

The business outcome is straightforward: fewer missed services, less coordination
time, and organized evidence for customers and workforce reviews.

## CRM separation

The CRM is separated at product and navigation level, but not infrastructure level
during this phase.

```text
WIAControl
├── Operations
│   ├── Coverage
│   ├── Time tracking
│   ├── Services
│   ├── Planning
│   └── Team
├── Sales (optional)
│   ├── CRM
│   ├── Invoices
│   └── Payments
└── Management
    ├── Business overview
    ├── Automations
    └── SaaS administration
```

This separation allows WIAControl to be sold without forcing a customer to replace
their CRM. A shared user, customer, worksite, and service database prevents
duplicates and premature integrations. The sales module can be extracted later if
it gains an independent release cycle.

## Implemented flow

- `/control`: daily coverage, alerts, and recommended replacements.
- `/worksites`: worksite configuration and verification rules.
- `/shifts`: daily/weekly planning and overlap-safe assignment.
- `/time-tracking`: time events, incidents, corrections, and CSV export.
- `/employee`: mobile clock-in, breaks, resumption, and clock-out.
- `/settings`: retention, time zone, and optional CRM.
- Local demo persistence and a real adapter over the same screens.
- Prisma models for worksites, shifts, events, incidents, corrections, and temporary
  inspection access.
- Authenticated, multi-tenant, idempotent APIs for the critical flow.
- Explainable recommendations, persisted decisions, and communication outbox.

## Compliance-oriented design criteria

- Clock events are appended to history, never overwritten.
- Corrections retain original time, proposed time, reason, and status.
- Breaks have dedicated event types.
- Method and worksite are recorded for every clock event.
- Location is checked only while clocking; continuous tracking is excluded.
- The real service layer applies role permissions, configurable retention, immediate
  export, and integrity sealing.

The demo uses local storage when `NEXT_PUBLIC_DEMO_MODE=true`. When disabled, the
provider loads and mutates data through APIs and PostgreSQL transactions without
changing screens.
