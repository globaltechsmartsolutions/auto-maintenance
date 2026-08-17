# Demo Data Synchronization

## Objective

Keep the local story coherent when a booking, customer, service, assignment, or
clock action appears in more than one module.

## Local source of truth

Demo state is owned by the demo provider and initialized from shared sample data.
Pages consume stable identifiers rather than duplicating independent records.
Session-local mutations update the related views together but are not durable.

## Synchronization rules

- A submitted booking creates or links one customer and one service request.
- CRM, service, and calendar views use the same customer and request identifiers.
- Assignment changes update the relevant service, shift, and coverage views.
- Clock events feed time tracking and incident detection without mutation.
- Corrections reference source events and never replace them.
- Invoice and payment examples link to the same customer where applicable.
- Repeated idempotent actions must not create duplicates.

## Test

Create a booking, locate the linked customer and service, schedule or assign it,
inspect the calendar, perform an employee clock action, and confirm the event in
time tracking. Refresh or reset the session and verify that the documented demo
behaviour is consistent.

## Real backend transition

Preserve these identifiers and contracts when replacing demo state with APIs.
Server transactions, authenticated tenant context, idempotency keys, and
post-mutation reads become the source of consistency. Demo and real modes must
remain explicitly separated.
