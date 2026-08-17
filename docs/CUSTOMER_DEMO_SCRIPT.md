# Customer Demo Script

## Main message

WIAControl gives a service company one operational view of worksites, shifts,
employee time tracking, coverage incidents, and assisted replacements. CRM,
billing, and communication support this core workflow.

## Preparation

Run all checks, reset demo state, prepare desktop and mobile views, and confirm
that the browser console is clean. Use one coherent customer story.

## Walkthrough

### 1. Sign-in and dashboard

Explain roles and company isolation. Use the overview for context, then move to
operations rather than spending the demo on generic charts.

### 2. Operations control

Open `/control`, identify an uncovered shift, inspect the evidence, and request
replacement candidates. Show score reasons and explain that the coordinator
remains responsible for the final decision.

### 3. Public booking

Submit a request through `/booking`. Explain how validated booking data can feed
CRM, planning, and staffing without exposing internal employee data.

### 4. CRM, services, and calendar

Show the pipeline, a customer record, service assignment, and weekly planning.
Position CRM as an optional module connected to the operational product.

### 5. Employees, worksites, and shifts

Show the reliable inputs for recommendations: employee status and skills,
worksites, planned shifts, availability, and absences.

### 6. Employee time tracking

Use `/employee` at mobile width for clock-in, break, and clock-out. Then open
`/time-tracking` to show source events, detected incidents, and reviewed
corrections. Original clock evidence is never overwritten.

### 7. Billing and customer follow-through

Briefly show invoices, payments, reminders, and the customer portal. Identify
simulated providers directly.

## Honest readiness answer

The core workflows are ready for a local product demonstration. Production use
still requires configured authentication and persistence, migrations, webhooks,
communications, monitoring, backups, security review, and a controlled pilot.

## Close

Return to the business result: fewer uncovered shifts, faster incident
resolution, defensible time records, and better coordinator decisions. Agree on
the pilot company, success metrics, data owner, and next phase.
