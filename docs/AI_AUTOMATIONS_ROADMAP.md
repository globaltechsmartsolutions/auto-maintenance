# AI and Intelligent Automations Roadmap

## Objective

Use explainable automation to reduce coordinator workload without hiding rules,
removing accountability, or creating unsafe staffing decisions.

## Assignment design

The system interprets a request into structured requirements, applies hard
eligibility rules, ranks valid employees, presents reasons and confidence, and
records a human decision. Ranking considers skill fit, schedule, travel,
continuity, workload fairness, and measured outcomes.

## Strong demonstration MVP

- Pending staffing requests and uncovered shifts.
- Top three eligible candidates with score breakdowns.
- Explicit exclusion reasons for ineligible employees.
- Coordinator confirmation, override, and reason capture.
- Decision history and a recommendation-quality dashboard.
- Clear no-candidate and low-confidence states.

## Service architecture

The public booking API validates customer input and creates a structured request.
An optional language service can classify free text. The recommendation API uses
trusted tenant context and deterministic eligibility before ranking. The
assignment API commits the chosen result transactionally and enqueues messages.

## Required data

Employees need status, skills, certifications, availability, absences, areas,
contract limits, and outcome history. Services need requirements, location,
duration, urgency, time windows, and customer constraints. Decisions need the
candidate snapshot, reasons, policy version, actor, override, and outcome.

## Customer assistant

The booking assistant may clarify service type, location, preferred time, and
special requirements. It must not promise an employee or exact availability
until validated by the scheduling domain.

## Coordinator assistant

The internal assistant may summarize coverage risks, explain recommendations,
draft customer messages, and propose next actions. Every mutation still uses the
same authorization, validation, and audit services as the standard interface.

## Phases

1. Deterministic explainable recommendation in demo and tests.
2. Structured conversational help for booking and coordinators.
3. Shadow evaluation using real pilot decisions and outcomes.
4. Controlled auto-assignment for approved low-risk cases.
5. Daily optimization, route estimates, fairness, and drift monitoring.

## Product recommendation

Sell operational reliability and saved coordination time, not vague artificial
intelligence. Success metrics are coverage rate, time to fill, incident age,
override rate, travel, overtime, employee fairness, and customer outcomes.
