# Manual Local Demo QA

## Result

The local demo is acceptable when the automated quality gate passes and the
critical user stories below complete without browser-console errors.

## Routes

Review authentication, dashboard, control, booking, CRM, customer profile,
services, calendar, employees, worksites, shifts, time tracking, employee mobile
view, invoices, payments, automations, customer portal, settings, and platform
administration.

## Interactions

- Navigate with desktop and mobile menus.
- Submit a booking and confirm linked demo records.
- Move a lead and inspect its customer history.
- Assign a service and change its schedule.
- Create or edit a worksite and shift.
- Clock in, start and end a break, and clock out.
- Detect an incident, propose a correction, and review it.
- Request a replacement recommendation and record a decision.
- Exercise simulated invoice, payment, and automation actions.

## API checks

Verify success, validation errors, unauthorized access, wrong-role access,
wrong-company access, duplicate idempotency keys, and missing-resource responses
for every core route handler.

## Technical gate

Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
Inspect mobile layouts, focus order, labels, loading states, empty states, and the
console. Record any failure with route, role, input, expected result, actual
result, and reproduction steps.

## Presentation note

Reset demo state before presenting and identify every simulated integration.
Passing this checklist approves a demo, not live production use.
