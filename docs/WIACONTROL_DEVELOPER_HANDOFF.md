# WIAControl Developer Handoff and Completion Plan

**Audience:** Implementation owner joining the project

**Goal:** take WIAControl from a validated product foundation to a secure,
observable, pilot-ready workforce operations platform.

Read this document first, then use
[`WIACONTROL_PRODUCT_ROADMAP.md`](WIACONTROL_PRODUCT_ROADMAP.md) as the detailed
product roadmap. This handoff turns that roadmap into an execution order.

## 1. Product mission

WIAControl is the operational system of record for service companies. It connects
worksites, planned shifts, employee time records, incidents, corrections, and
assisted replacements.

The product must make three roles successful:

- **Employee:** sees assigned work, clocks in and out, starts or ends breaks,
  and requests a correction when a record is wrong.
- **Coordinator:** sees daily coverage, resolves attendance incidents, and
  confirms a replacement with evidence and an audit trail.
- **Administrator:** configures company policy, employees, worksites, roles,
  retention, exports, subscription, and optional CRM features.

CRM, billing, and customer communication are supporting modules. Do not let them
delay the core operations workflow.

## 2. First-day setup

```bash
npm ci
npm run prisma:generate
npm run quality
npm run build
```

For full release-equivalent verification, run:

```bash
npm run preprod:verify
```

Start the local demo with `npm run dev`. The application supports demo mode via
`NEXT_PUBLIC_DEMO_MODE=true`; real mode requires the environment variables listed
in `README.md`.

Useful routes:

| Route | Purpose |
| --- | --- |
| `/control` | Daily coverage, gaps, incidents, and replacements. |
| `/employee` | Mobile employee clocking. |
| `/time-tracking` | Clock evidence, corrections, and incident review. |
| `/worksites` | Worksite management. |
| `/shifts` | Shift planning. |
| `/settings` | Company policies and optional modules. |
| `/booking` | Public booking flow. |

## 3. Non-negotiable rules

1. Keep every user-facing string, technical identifier, route, test name, and
   document in English.
2. Every protected read or mutation must resolve the authenticated viewer and
   company on the server. Never trust a company ID provided by the browser.
3. Clock events are append-only. Corrections are separate records linked to the
   original event; do not overwrite evidence.
4. Recommendations may assist a coordinator, but deterministic hard constraints
   always come first and a coordinator remains accountable for the choice.
5. Point-in-time location verification is permitted only when company policy
   enables it. Continuous employee tracking is out of scope.
6. Demo mode and real mode must use the same domain rules and must never share
   data.
7. Do not use production credentials or customer data in local or staging work.

## 4. Architecture map

| Area | Primary location | Responsibility |
| --- | --- | --- |
| Pages and route handlers | `src/app` | UI routes, server entry points, HTTP contracts. |
| Operations UI | `src/components/control` | Coordinator, worksite, shift, and employee views. |
| Domain services | `src/lib/wia-control` | Transactions, validation, audit, and business rules. |
| Recommendation engine | `src/lib/assignment` | Deterministic candidate eligibility and scoring. |
| Authentication and roles | `src/lib/auth` | Viewer resolution and permissions. |
| Database model | `prisma/schema.prisma` | Tenant-scoped persistent entities. |
| Migrations and seed | `prisma/migrations`, `prisma/seed.mjs` | Reproducible database evolution. |
| Automated checks | `.github/workflows/quality.yml` | Clean install, Prisma generation, and release verification. |

Keep domain rules out of React components. UI actions should call a validated
server route or server action; domain services should own the transaction.

## 5. Delivery order

Complete each checkpoint before starting the next one. A checkpoint is not done
until its acceptance criteria and quality checks pass.

### Checkpoint A — Staging and real identity

**Outcome:** a test company can sign in safely to a separate staging environment.

Tasks:

1. Provision staging Supabase, PostgreSQL, Stripe test mode, and deployment
   environment variables.
2. Apply migrations from a clean database using `npm run db:migrate:deploy`.
3. Seed a test company and accounts for administrator, coordinator, and employee.
4. Verify sign-in, password recovery, disabled users, wrong-role access, and
   cross-company denial.
5. Add or complete automated tests for role and tenant boundaries.

Exit criteria:

- Every operations API is inaccessible without the required role.
- A user cannot read or mutate another company’s record by changing an ID.
- Staging contains no production data or credentials.

### Checkpoint B — Trustworthy time tracking

**Outcome:** real employees can record a shift without corrupting time evidence.

Tasks:

1. Validate the full clock sequence: clock-in, break start, break end, and
   clock-out.
2. Add explicit device, time zone, submitted-time, and idempotency behaviour.
3. Implement offline queue and retry behaviour; retries must not duplicate an
   event.
4. Validate location permission, unavailable location, weak signal, expired
   shift, and duplicate-submission user messages.
5. Test correction request, employee acknowledgement, company approval/rejection,
   and export audit trail.

Exit criteria:

- Repeating an idempotency key produces exactly one clock event.
- Original events remain unchanged after a correction.
- Employees can access only their own time records.
- An administrator can export and explain the resulting record history.

### Checkpoint C — Operational incident workflow

**Outcome:** coordinators can turn exceptions into accountable decisions.

Tasks:

1. Configure company policy for grace period, late threshold, missing clock-in,
   incomplete shift, and location verification.
2. Run incident detection idempotently from a route, scheduled job, or worker.
3. Add severity, owner, due time, acknowledgement, resolution, dismissal, and
   escalation categories.
4. Complete the coordinator incident inbox with worksite, employee, date,
   severity, and status filters.
5. Record every action in audit history and prevent duplicate notifications.

Exit criteria:

- Detection can run repeatedly without duplicate incidents.
- Every open incident has a visible next action and owner.
- Resolution time and false-positive rate can be measured.

### Checkpoint D — Explainable replacement decisions

**Outcome:** WIAControl helps fill a gap without hiding or automating a critical
staffing decision.

Tasks:

1. Enforce hard filters for company, active status, skills, availability,
   absence, overlapping shifts, work area, and working-time limits.
2. Return a deterministic score breakdown for each eligible candidate.
3. Show top candidates, exclusions, confidence, and warnings in `/control`.
4. Require a reason for a lower-ranked override when policy requires it.
5. Confirm the selected replacement, resolve the incident, queue communication,
   and write audit data in one transaction.
6. Store accepted recommendations and overrides for later evaluation.

Exit criteria:

- Ineligible employees are never selectable.
- The same policy and input produce the same rank order.
- Coordinators can override safely and explain why.
- Automatic assignment remains disabled until pilot evidence supports it.

### Checkpoint E — Communication reliability

**Outcome:** operational decisions reach the people affected by them.

Tasks:

1. Run the communication outbox through a worker with idempotency, retry,
   backoff, and dead-letter visibility.
2. Start with in-app and email delivery.
3. Add employee acknowledgement for reassigned shifts.
4. Provide delivery status, manual resend, notification preferences, and
   company templates.
5. Add SMS or WhatsApp only after consent, provider, cost, and failure handling
   are approved.

Exit criteria:

- A decision is not shown as communicated until delivery succeeds or fails
  visibly.
- Retries are bounded, observable, and never duplicate a message.

### Checkpoint F — Pilot and production readiness

**Outcome:** one to three pilot companies can use the core workflow reliably.

Tasks:

1. Instrument structured logs, health checks, latency, errors, failed clocking,
   incident age, recommendation acceptance, override reasons, and outbox failures.
2. Create backup, restore, migration rollback, and support playbooks.
3. Run a four-to-six-week pilot with nominated customer champions.
4. Review product feedback weekly and prioritise defects before new sales features.
5. Complete privacy, retention, access, and data-processing review for target
   markets with qualified advisers.

Exit criteria:

- At least 95% of pilot clock submissions complete without manual support.
- No critical tenant-isolation or data-integrity issue is open.
- Pilot coordinators resolve common incidents without engineering help.

## 6. Immediate sprint backlog

Complete these in order unless a production-blocking defect appears:

1. Add a typed English translation catalogue and a test that detects accidental
   Spanish UI copy on core routes.
2. Add end-to-end coverage for clock-in, duplicate retry, correction, incident,
   recommendation, override, and coverage confirmation.
3. Define and implement offline clock-event queue behaviour.
4. Add incident severity, owner, due time, and coordinator inbox filters.
5. Complete staging setup and documented test-account provisioning.
6. Add tenant-isolation tests to every critical route handler.
7. Connect and test the communication outbox worker.
8. Add operational metrics and alerts for core failures.
9. Rehearse database migration, restore, and rollback.
10. Run a controlled pilot workflow with test users before onboarding a customer.

## 7. Required working practice

For every change:

1. Create a focused branch and pull request.
2. State the user outcome, affected roles, database impact, and rollback plan.
3. Add or update tests for the happy path and one meaningful failure path.
4. Run `npm run preprod:verify` before requesting merge.
5. Never merge a failing PR or bypass the quality workflow.
6. Update the relevant roadmap, API contract, or operational documentation.

For schema changes:

1. Create a migration; do not rely only on `db push`.
2. Test it against a clean database and representative seeded data.
3. Decide whether rollback is safe or a forward-fix is required.
4. Confirm tenant indexes, foreign keys, retention, and audit implications.

## 8. Definition of "WIAControl complete"

WIAControl is ready for a controlled commercial launch when all of the following
are true:

- Real authentication, roles, and tenant isolation are enforced server-side.
- Employees can reliably clock a complete shift and request traceable corrections.
- Coordinators can detect, own, and resolve incidents and coverage gaps.
- Replacement recommendations are deterministic, explainable, auditable, and
  human-confirmed.
- Communications, exports, audit records, backups, migrations, monitoring, and
  support playbooks operate in staging and pilot.
- CI passes on every merge, production credentials are isolated, and a pilot has
  met the agreed success criteria.
- Privacy, retention, employment-policy, and commercial readiness reviews are
  signed off by the appropriate business owners.

Do not mark the product complete merely because the local demo looks finished.
The standard is reliable operational use by a real service company.


## 6a. Translation fixes required

Track every accidental non-English string found on core routes here, with the
exact file, line, and the approved English replacement. Update this table as
new occurrences are found or fixed; do not remove a row until the fix has
merged and the detection test (see section 6, item 1) passes.

| File | Line | Current string | Replace with |
| --- | --- | --- | --- |
| `components/controler/worksites-dashboard.tsx` | 160 | "Radio permitido (metros)" | "Allowed radius (meters)" |

| `components/controler/shift-planner.tsx` | 194 | "Competencias requeridas" | "Required skills" |

| `components/controler/time-tracking-dashboard.tsx` | 138 | "Eventos recibidos" | "Received Events" |

| `components/controler/time-tracking-dashboard.tsx` | 151 | "Verificados" | "Verified" |

| `components/controler/time-tracking-dashboard.tsx` | 207 | "Eventos" | "Events" |

| `components/controler/time-tracking-dashboard.tsx` | 238 | "Evento" | "Event" |

| `components/demo/demo-widgets.tsx` | 546 | "Recurrencia" | "Recurrence" |

| `components/demo/demo-widgets.tsx` | 657 | "Rendimiento" | "Performance" |

| `components/demo/demo-widgets.tsx` | 900 | "Canal" | "Channel" |

| `components/demo/demo-widgets.tsx` | 891 | "Reglas activas" | "Active Rules" |

| `components/demo/demo-widgets.tsx` | 899 | "Disparador" | "Trigger" |

| `components/demo/demo-widgets.tsx` | 2404 | "Canal" | "Channel" |

| `components/demo/demo-provider.tsx` | 2236 | "Recurrencia" | "Recurrence" |

| `components/demo/demo-provider.tsx` | 2397 | "Disparador" | "Trigger" |

| `components/controler/employee-clock.tsx` | 230 | "Dispositivo autorizado" | "Authorized Device" |

| `components/controler/employee-clock.tsx` | 223 | "Identificada" | "Identified" |

| `components/controler/employee-clock.tsx` | 349 | "Corregir" | "Correct" |

| `components/controler/employee-clock.tsx` | 109 | "Date and time correctas" | "Correct date and time" |




## 5a. Work log

Track daily progress here in chronological order. Each entry should be short
and dated, so the next contributor (or the same one, later) can see what state
the project was left in.

### 2026-08-17

1. Pulled the project from GitHub.
2. Run the project on the local system.
3. Reviewed and understood the project structure and codebase.
4. Connected the project to the database.
5. Checked Coverage and Worksites page, and fix the translation issues.