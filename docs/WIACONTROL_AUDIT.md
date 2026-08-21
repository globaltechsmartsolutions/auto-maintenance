# WIAControl independent audit

This is the single running record of the independent audit. It distinguishes
code review, automated verification, deployed database safeguards, and manual
pilot checks. A green test suite is evidence for the scenarios named below; it
is not a claim that a production pilot, legal review, or monitoring setup is
complete.

## Audit method

For each block, the review follows the same sequence:

1. Trace the request from authentication through tenant/role resolution to the
   database query or write.
2. Try cross-company identifiers, an unauthorised role, an invalid state
   transition, and a partially completed operational action.
3. Add a focused regression test for each confirmed defect.
4. Fix the invariant at the narrowest reliable boundary: query, service, or
   database constraint.
5. Run the affected tests, then the full quality gate.

## Blocks 1–3: foundations, commitments, and field team

**Code audit status: passed with five confirmed defects fixed.**

### Confirmed findings and fixes

| Ref | Severity | Finding | Fix and regression coverage |
| --- | --- | --- | --- |
| A-01 | High | A field worker could list every active worksite in their company. Some sensitive columns were absent, but unrelated service locations were still disclosed. | `listWorksites` now requires a planned shift assigned to that employee. `commitments.test.ts` asserts the tenant-and-assignment query. |
| A-02 | High | `AuditLog` was written as an append-only convention only; a server/database credential could still update or delete audit history. | Migration `20260821130000_audit_log_append_only` adds PostgreSQL triggers rejecting updates and deletes. It is applied and verified in staging. |
| A-03 | Medium | Changing a worksite's customer could leave old shifts linked to services for a different customer, corrupting the operational history. | The service layer refuses the customer change whenever a linked service shift belongs to another customer. `commitments.test.ts` covers the refusal. |
| A-04 | Medium | Changing a service's customer had the inverse historical-integrity problem. | The service layer refuses the move whenever its shifts use worksites for another customer. `commitments.test.ts` covers the refusal. |
| A-05 | High | Deactivating an employee released only future shifts. A shift already late but still unstarted could remain assigned to a disabled login and never enter recovery. | Deactivation now releases every non-completed, non-cancelled shift that is not actually `ACTIVE` or `PAUSED`, and opens the standard uncovered-shift incident. `field-team.test.ts` covers the query and outcome. |

### Controls verified

- An ordinary user is bound to their own company even if they submit another
  `companyId`; only a super admin may select a workspace.
- A user without a company never receives an unscoped query.
- Disabled users are refused even when Supabase still has a valid session.
- Staging PostgreSQL was checked read-only: every table in the `public`
  schema has Row Level Security enabled and there are no permissive public
  policies. The Supabase publishable key therefore cannot bypass the server's
  company and role checks through the Data API.
- Employee reads are limited to the employee's own profile, shifts, services,
  and worksites; internal notes, performance, revenue, QR credentials, and
  unrelated employee shifts are not selected.
- Customer/worksite/service creation validates that referenced records belong
  to the active company.
- Worksites with open shifts cannot be archived.
- Employee deactivation retains history, disables application access, prevents
  deactivation during a live shift, releases unstarted assignments, and audits
  the action.

### Verification run

On 2026-08-21:

```text
npm run quality
29 test files passed
319 tests passed
lint passed
TypeScript typecheck passed
Prisma schema validation passed
```

### Staging deployment verification

The initial migration attempts were blocked by an idle Supavisor session
holding Prisma's advisory lock. The stale local Prisma processes and that idle
database session were terminated after inspection. The migration then applied
successfully. Staging confirms both `AuditLog_prevent_update` and
`AuditLog_prevent_delete` triggers are active.

Use the session-pooler database connection for Prisma migrations in this
environment. Do not use `db push` or edit applied migration files.
