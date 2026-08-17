# Visual and Functional QA Audit

## Summary

The local WIAControl experience was reviewed on desktop and mobile across
authentication, dashboard, booking, CRM, services, calendar, employees,
invoices, payments, automations, customer portal, employee clocking, and
operations-control modules.

## Corrections

The review aligned navigation, statuses, empty states, button copy, responsive
spacing, form labels, demo data, and linked records. It removed invalid sample
employee references, repaired label associations, and reduced hot-reload
hydration inconsistencies.

## Functional coverage

- Authentication and responsive navigation.
- Booking creation and downstream demo synchronization.
- CRM movement, profiles, history, and follow-up.
- Service assignment and calendar scheduling.
- Employee, worksite, and shift management.
- Invoice, payment, automation, and portal actions.
- Employee clock-in, break, and clock-out.
- Coverage recommendations, incidents, and corrections.

## Data and visual checks

Customer, employee, service, and booking identifiers must resolve consistently
across views. Demo mutations are session-local and must not be presented as
durable writes. Priority visual checks cover overflow, mobile navigation, dense
tables, status contrast, keyboard focus, labels, loading, empty states, errors,
and action placement.

## Risks

- External services may be unconfigured locally.
- Hot reload can leave stale browser state; reload before presenting.
- Simulated data must be described honestly.
- Large operations tables need extra attention on narrow screens.
- Any build failure or browser-console error blocks release.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Before a customer demo, traverse the route sequence, test one complete
booking-to-assignment story, inspect the console, and repeat employee and booking
flows at a mobile viewport.

## Verdict

The application is suitable for an honest local demonstration after all checks
pass. Production approval additionally requires real authentication, persistence,
billing, monitoring, privacy, backup, and operational controls.
