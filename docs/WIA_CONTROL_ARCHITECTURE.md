# WIAControl Architecture

## Layers

```text
Interface
├── Coordinator dashboard
├── Time tracking
└── Employee area
        │
        ▼
Domain contract
├── Zod schemas
├── Clock-event sequence
├── Overlap rules
├── Late-arrival rules
└── Point-in-time location verification
        │
        ├── Local demo adapter → localStorage
        │
        └── Real services → Prisma → PostgreSQL
```

The interface does not decide which clock-event sequence is valid. That rule lives in
`src/lib/wia-control/domain.ts` and is shared by the demo and real service layers.

## Tenant isolation

Every real operation receives an actor with `companyId`, role, user, and—when
applicable—an employee profile. Queries are scoped to the company before reading or
modifying a resource. A `SUPER_ADMIN` must explicitly select the target company;
other roles cannot override their company through browser-submitted data.

## Transactional operations

Critical operations run in a transaction:

- Creating a shift validates the worksite, employee, and overlaps before saving.
- Clocking validates idempotency, sequence, and shift ownership; it then creates the
  event, updates state, detects incidents, and writes the audit record.
- Requesting a correction retains the original event and creates a separate request.
- Confirming coverage assigns the replacement, resolves the incident, stores the
  decision, queues communication, and writes the audit record atomically.

## Time-record integrity

Each real event contains:

- a company-unique idempotency key;
- the previous event hash;
- a SHA-256 hash of relevant content;
- declared and received timestamps;
- method, device, and point-in-time verification outcome.

The migration creates triggers that reject `UPDATE` and `DELETE` on `ClockEvent`.
A correction is represented by `TimeCorrectionRequest`; the original evidence is
never modified.

## API

| Method and route | Purpose |
| --- | --- |
| `GET /api/control/day?date=YYYY-MM-DD` | Coordinator or employee day view |
| `GET /api/control/worksites` | Active worksites |
| `POST /api/control/worksites` | Create a worksite |
| `PATCH /api/control/worksites/:id` | Edit or archive a worksite |
| `POST /api/control/shifts` | Create a validated shift |
| `PATCH /api/control/shifts/:id` | Assign, reschedule, or cancel a shift |
| `POST /api/control/clock-events` | Create an idempotent clock event |
| `GET/POST /api/control/corrections` | List or request corrections |
| `PATCH /api/control/corrections/:id` | Review, confirm, or dispute a correction |
| `PATCH /api/control/incidents/:id` | Review or close an incident |
| `POST /api/control/incidents/detect` | Idempotently detect incomplete shifts |
| `POST /api/control/coverage/recommend` | Explainable replacement recommendation |
| `POST /api/control/coverage` | Confirm a replacement |
| `GET /api/control/communications` | Provider-independent communication outbox |
| `GET/PATCH /api/control/settings` | Company policies and optional CRM |
| `GET /api/control/export/clocks` | Audited time-record CSV export |
| `GET /api/health` | Configuration and database health |

Routes return normalized errors with a `code`, never internal traces. Demo mode is
enabled only through an explicit variable; incomplete pre-production configuration
returns `503`.

## Migrations and seed data

- Baseline migration: `prisma/migrations/20260808190000_wia_control_baseline`.
- Communication outbox and optional CRM:
  `prisma/migrations/20260808210000_communication_outbox`.
- The seed creates companies, users, customers, services, worksites, shifts, clock
  events, and incidents.
- Seed clock events are created only once to respect their append-only nature.
