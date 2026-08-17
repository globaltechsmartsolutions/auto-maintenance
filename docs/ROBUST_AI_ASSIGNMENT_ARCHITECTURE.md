# Robust AI Assignment System Architecture

## Objective

Build a multi-tenant system that recommends staffing safely, learns from real
decisions, and supports controlled automation without making a probabilistic
model an unreviewed authority.

## Principles

- AI assists; accountable people and validated policies decide.
- Safety, labour constraints, and tenant isolation precede optimization.
- Every input, rule version, score, recommendation, override, and outcome is
  auditable.
- Clock events and decision evidence are append-only.
- Missing data or low confidence leads to review, not fabricated certainty.

## Target flow

```text
Public booking / Operations console / Employee app
                         |
                 Authenticated APIs
                         |
       Tenant policy and eligibility services
                         |
        Explainable recommendation engine
                         |
 Coordinator decision and transactional assignment
                         |
 PostgreSQL audit history, metrics, and outbox
```

## Components

1. The public request API validates and stores bookings without exposing staffing.
2. The coverage service calculates open, covered, late, and at-risk shifts.
3. The eligibility engine enforces skill, absence, overlap, worksite, and labour rules.
4. The ranking engine produces versioned scores, reasons, and confidence.
5. The decision service records confirmation or override and assigns atomically.
6. The incident service reviews inconsistent clock evidence without rewriting it.
7. The communication outbox delivers notifications with retry and idempotency.
8. Observability measures coverage, errors, overrides, and recommendation quality.

## Data model

The minimum model contains companies, users, roles, employees, worksites,
skills, work areas, availability, absences, services, bookings, shifts, clock
events, incidents, corrections, recommendations, candidate scores, decisions,
communications, and audit entries. Every business query is tenant-scoped.

Recommendations store the request snapshot, candidates, exclusions, policy or
model version, score components, confidence, and expiration. Decisions store the
selected employee, actor, reason, override category, and timestamp. Outcomes are
joined later without mutating the original evidence.

## Shadow mode and automation

New policies first produce recommendations without changing assignments.
Controlled automation can be enabled per company only after hard constraints,
confidence thresholds, reversibility, monitoring, and an emergency disable
switch are proven.

## LLM boundary

An LLM may structure free text or phrase explanations. It cannot be the sole
enforcer of authorization, availability, labour rules, billing, or assignment
transactions.

## Integrations and security

Supabase provides authentication and PostgreSQL hosting. Routing supplies travel
estimates. Calendar synchronization is idempotent. Stripe handles subscriptions,
and communication providers consume the outbox. Server-side role checks, tenant
filters, least-privilege credentials, rate limits, audit logs, retention rules,
and privacy controls are mandatory. Location is checked only when clocking;
continuous tracking is out of scope.

## Delivery phases

1. Stabilize the deterministic local experience.
2. Connect the database, authentication, roles, and real APIs.
3. Pilot recommendation-only mode with one company.
4. Enable controlled automation for low-risk cases.
5. Add daily optimization, travel estimates, and fairness monitoring.
6. Add conversational help around validated domain services.

Production approval also requires automated isolation tests, rollback and backup
procedures, monitoring, incident playbooks, privacy review, and named owners.
