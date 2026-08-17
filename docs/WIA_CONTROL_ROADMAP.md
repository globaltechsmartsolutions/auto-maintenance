# WIAControl Master Roadmap

## Objective

Build an intelligent workforce time-tracking and coverage platform for service
companies. The core product connects worksites, shifts, clock evidence,
incidents, corrections, and replacement decisions. CRM is optional.

## Product principles

- Operations before generic business dashboards.
- Append-only evidence and explicit corrections.
- Explainable assistance before autonomous decisions.
- Server-enforced roles and tenant isolation.
- Point-in-time location verification, never continuous tracking.
- Configurable company policies and honest demo boundaries.

## MVP scope

The MVP includes company and role context, employees, worksites, shifts,
availability, clock-in/out and breaks, incident detection, correction review,
daily coverage, explainable replacement recommendations, decision audit,
settings, exports, health checks, and responsive employee use.

Advanced route optimization, payroll processing, biometric identity, continuous
location, and fully autonomous staffing are outside the initial scope.

## Milestones

### 0. Definition and audit

Confirm terminology, roles, data ownership, privacy boundary, success metrics,
and the state of existing demo and backend code.

### 1. Stability and security baseline

Pass lint, types, tests, and build; remove stale routes; validate configuration;
and enforce authentication, authorization, and tenant context.

### 2. Domain and persistence

Complete migrations, transactional services, append-only clock evidence,
idempotency, audit logs, and seeded pre-production data.

### 3. Worksites, shifts, and planning

Deliver management workflows, overlap rules, work areas, daily and weekly views,
availability, and absences.

### 4. Time tracking and review

Deliver employee clocking, break policy, incident detection, correction approval,
exports, privacy language, and retention rules.

### 5. Intelligent coverage

Deliver hard-rule eligibility, ranked replacements, explanations, confidence,
coordinator decisions, shadow evaluation, and recommendation metrics.

### 6. Roles and optional modules

Harden administrator, coordinator, and employee separation. Keep CRM and billing
behind explicit company configuration.

### 7. Pre-production and pilot

Configure real infrastructure, monitoring, backups, providers, security review,
and a recommendation-only pilot with measurable exit criteria.

## Quality gates

Each milestone requires automated verification, browser QA, accessibility,
tenant-isolation evidence, migration safety, observable failures, documentation,
and an accountable owner. The detailed canonical plan is
`WIACONTROL_PRODUCT_ROADMAP.md`.
