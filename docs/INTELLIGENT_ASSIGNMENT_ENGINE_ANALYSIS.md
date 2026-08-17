# Intelligent Employee Assignment Engine Analysis

## Purpose

The assignment engine helps an operations coordinator fill a service or shift
with the best eligible employee. It must be explainable, auditable, and safe:
business rules filter candidates, a score ranks the remaining people, and an
authorized person confirms the operational decision.

## Problem

Manual assignment becomes slow and inconsistent across several worksites,
skills, absences, travel constraints, and overlapping shifts. The system must
answer who is eligible, who is the strongest candidate, and why each person was
recommended or rejected.

## Decision pipeline

1. Normalize service type, skills, worksite, time window, duration, urgency,
   equipment, and customer constraints. Free text may be classified by an LLM,
   but the structured result must be validated.
2. Exclude inactive, absent, unavailable, unqualified, overlapping, out-of-area,
   or working-time-ineligible employees. A score can never bypass these rules.
3. Rank eligible candidates by skill fit, travel, schedule margin, punctuality,
   completion and acceptance history, continuity, fair workload, and confirmed
   coordinator preferences.
4. Return the top candidates with score breakdowns, reasons, confidence, and
   warnings. Low confidence requires human review.
5. Record confirmation or override, the actor and reason, policy version, and
   eventual operational outcome.

## Intelligence levels

1. **Explainable recommender:** rank candidates for one open shift.
2. **Daily optimizer:** reduce full-day gaps, overtime, and unnecessary travel.
3. **Route optimizer:** jointly optimize assignments, routes, windows, and breaks.

## Required data

Employee data includes status, skills, certifications, contract limits,
availability, absences, area, preferences, and outcomes. Service data includes
skills, location, duration, priority, and time window. Decision history retains
the candidate set, exclusions, scores, recommendation, coordinator choice,
override reason, and final outcome.

## AI boundary

AI may classify requests, summarize evidence, identify patterns, and explain a
recommendation. It must not relax safety rules, invent availability, make
discriminatory decisions, or silently modify schedules. Eligibility remains a
deterministic policy decision.

## Learning strategy

Start with explicit weights. Run new models in shadow mode, compare them with
real decisions and outcomes, and promote them only after documented evaluation.
Learning signals include overrides, delays, cancellations, continuity, travel,
and completed work. Sensitive attributes must not become ranking shortcuts.

Safe auto-assignment requires every hard constraint to pass, high confidence,
no meaningful tie, an approved policy version, a complete audit record, and a
reversible action.

## Initial delivery scope

Deliver a pending-assignment queue, hard-rule eligibility, deterministic ranking,
the top three candidates, reason chips, confidence, coordinator confirmation or
override, and audit history. Route optimization and autonomous scheduling belong
to later phases.

## Acceptance criteria

- Identical input and policy version produce the same result.
- Ineligible employees never appear as selectable candidates.
- Every score and exclusion is explainable.
- Cross-company data access is impossible.
- Overrides and outcomes are measurable.
- Low-confidence cases are never silently assigned.

See `WIACONTROL_PRODUCT_ROADMAP.md` for the delivery sequence.
