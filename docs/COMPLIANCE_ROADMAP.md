# Compliance Review Roadmap

## Status definitions

- **Not started:** no evidence exists.
- **In progress:** an owner and implementation exist but validation is incomplete.
- **Verified:** evidence, tests, and an accountable reviewer confirm the control.

## Phase 1: Technical baseline

- Inventory personal data, purposes, storage, providers, and retention periods.
- Enforce authentication, least privilege, tenant isolation, and secret handling.
- Define audit, backup, restoration, vulnerability, and incident procedures.
- Document deployment environments and change approval.

## Phase 2: Workforce product controls

- Keep clock events append-only and corrections separately attributable.
- Define location consent and point-in-time verification; prohibit continuous tracking.
- Document employee access, dispute, correction, and export procedures.
- Make worktime, break, and overtime policies configurable per company.
- Review accessibility and employee transparency language.

## Phase 3: Intelligent assignment controls

- Document ranking inputs, exclusions, weights, confidence, and policy versions.
- Exclude protected or unjustified attributes and test proxy risks.
- Require human review for low-confidence or high-impact decisions.
- Retain overrides, reasons, outcomes, and model-evaluation evidence.
- Provide an emergency disable switch and rollback path.

## Production gate

Legal review must match the deployment jurisdiction and customer contracts.
Complete data-processing terms, subprocessors, retention and deletion tests,
breach response, access reviews, monitoring, backup restoration, and documented
owners before accepting live workforce data.

This roadmap is an engineering control plan, not legal advice.
