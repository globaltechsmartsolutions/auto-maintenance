# WIAControl AI governance

The controls that stand between an AI feature and a customer, what is recorded
about every call, and what has to be signed off by a person before any of it is
switched on.

## The four locks

AI is off by default at four independent levels. All four must agree before a
single request reaches a provider, and each refusal has its own error code so
the reason is never guessed at.

| Lock | Where it lives | Refusal code |
| --- | --- | --- |
| Global kill switch | `AI_KILL_SWITCH=true` | `AI_KILL_SWITCH` |
| Environment configured | `AI_GATEWAY_API_KEY` and `AI_FEATURES_ENABLED=true` | `AI_NOT_CONFIGURED` |
| Company stop | `Company.aiDisabledAt` | `AI_DISABLED_FOR_COMPANY` |
| Per-company feature flag | `Company.aiFeatures` | `AI_FEATURE_NOT_ENABLED` |
| Authorised budget | `Company.aiMonthlyTokenBudget` | `AI_BUDGET_NOT_AUTHORISED`, `AI_BUDGET_EXHAUSTED` |
| Rate limit | 30 calls per company per feature per hour | `AI_RATE_LIMITED` |

The gate itself is a pure function, `evaluateAiGate` in
`src/lib/ai/governance.ts`, and every branch of it is covered by tests.

## Two kill switches, on purpose

`AI_KILL_SWITCH` stops every workspace at once and takes precedence over
everything, including a fully configured environment. `Company.aiDisabledAt`
stops one workspace without destroying its configuration, so it can be turned
back on without reconstructing what it had.

## What is recorded

Every call writes an `AiUsageRecord` — including the ones the gate refused —
with the feature, model, outcome, token counts, and a short reason. Alongside
it goes one audit entry named `ai.<feature>.<outcome>`, where outcome is one of
`generated`, `refused`, `failed`, `edited`, `approved`, or `cancelled`.

**Prompts and generated text are never written to the audit log.** The single
exception is an approved message: the text a named human accepted is recorded
in full, because "what exactly did we agree to send" must be answerable from the
trail alone.

`GET /api/control/ai/usage` reports the month's spend against the authorised
budget and the count of each outcome per feature. That is the record the pilot
review reads.

## What the model is allowed to receive

Only minimised operational facts: shift and incident identifiers, type,
severity, status, timestamps, worksite and shift names, and whether somebody is
assigned. Never employee names, never coordinates, never incident free text,
never credentials, and never attendance history beyond the requested period.

## What the output is checked for

Every generated output passes `checkAiOutput` before a human ever sees it. It is
refused if it contains a term that was withheld, cites an identifier that was
not supplied (prefixed ids and UUIDs alike), claims an action was taken, claims
legal compliance, or proposes an employment or payroll consequence. The same
check runs again on the final text at approval time, because an edit could
reintroduce any of them.

## No message reaches anyone without a named approver

An AI draft is stored, never sent. A coordinator may rewrite it freely.
Approving requires restating the subject and message being approved; that text
is copied into the communication outbox under the `coordinator_message`
template, and the draft records who approved it and when. A database `CHECK`
constraint enforces that an approved draft names its approver, so the rule holds
even against a direct write.

## The evaluation set

`aiEvaluationScenarios` in `src/lib/ai/evaluation.ts` covers the five situations
the roadmap requires: a normal day, a no-show, a late arrival, a case with no
candidate, and an attempt to pull in another tenant's data. Each carries the
facts, the terms that must not appear, the identifiers that may appear, and the
behaviour a correct answer must show. The deterministic checks run against these
scenarios in the test suite; a model evaluation run records its results against
the same set.

## Never allowed

Autonomous staff assignment, performance scoring, disciplinary recommendations,
payroll calculation, continuous tracking, biometric analysis, and sending a
message without an accountable human approval. The risk explanation shown in the
recovery queue is deliberately **not** a model: it is derived from recorded
facts in `src/lib/wia-control/recovery-queue.ts`, so a coordinator can check
every sentence of it against the record.

## Before enabling this for any customer — owner tasks, not code

1. Choose the provider and confirm its processing location.
2. Complete the DPA, the subprocessor terms, and the retention policy with the
   privacy owner.
3. Set the company's `aiFeatures`, `aiMonthlyTokenBudget`, and a named cost
   owner.
4. Run the evaluation set against the chosen model and record the results. A
   wrong, invented, or unsafe output blocks release until corrected.
5. Name who watches `GET /api/control/ai/usage` and who may pull the kill
   switch.

None of these five are done by shipping code, and none of them are assumed
anywhere in this repository.
