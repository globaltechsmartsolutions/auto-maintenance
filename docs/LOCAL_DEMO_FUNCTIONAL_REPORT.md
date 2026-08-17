# Local Demo Functional Report

## Objective

Confirm that WIAControl can tell a coherent end-to-end product story locally
without depending on production services.

## Delivered experience

- Responsive authentication and application shell.
- Dashboard and optional CRM workflow.
- Public booking, customer profile, services, and calendar.
- Employee, worksite, shift, and time-tracking modules.
- Coverage incidents and explainable replacement recommendations.
- Invoice, payment, automation, and customer-portal demonstrations.
- Mobile employee clocking with point-in-time verification.

## Manual scenarios

The demo was exercised from booking to operational planning, from a coverage gap
to a coordinator decision, and from employee clock-in to incident review. Linked
sample identifiers remain consistent across views.

## Verification

The release gate is lint, TypeScript checking, unit tests, and a production build.
The browser console and mobile layouts must also be inspected immediately before
presentation.

## Limitations

Demo state is simulated and session-local unless the real backend is configured.
External communications and payments may be placeholders. These limitations
must be stated clearly during the demonstration.

## How to run

Follow `LOCAL_DEMO.md` and use `CUSTOMER_DEMO_SCRIPT.md` for the presentation.
