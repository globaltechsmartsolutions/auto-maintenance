# Intelligent Demo QA

## Scope

Validate synchronization between public booking, operational records, and the
explainable assignment engine.

## Scenarios

### Recommendation by service type

Create requests with different required skills. Eligibility and ranking must
change for understandable reasons, with the top candidate, score components,
warnings, and confidence visible.

### Learning and controlled automation

Record accepted recommendations and overrides. Feedback becomes decision
evidence; it must not silently rewrite the active policy. Low-confidence or
rule-conflicting cases cannot be auto-assigned.

### Negative case

Create a request for which everyone is unavailable, unqualified, absent, or
overlapping. The system returns a clear no-candidate state and invents no fallback.

### Booking synchronization

Submit a booking and verify consistent identifiers in CRM, services, and
calendar. Retrying an idempotent request must not duplicate records.

### Authentication and responsive layout

Exercise sign-in, invoice and payment simulations, desktop navigation, mobile
booking, and mobile clocking. The console stays clean and controls have labels.

## Regression checks

- Assigned employee identifiers must exist in the dataset.
- Select controls must be associated with visible labels.
- Development hot reload must not leave stale hydration state.

## Validation

Run lint, type checking, unit tests, and a production build. Release QA also
needs API authorization, isolation, idempotency, and transaction tests.

The local engine demonstrates explainable recommendations. Do not describe it as
a self-training production model until real outcomes, shadow evaluation,
approval thresholds, and drift monitoring exist.
