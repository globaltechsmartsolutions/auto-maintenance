# WIAControl delivery log

One release note per completed work package, as required by delivery rule 5 of
the [product roadmap](WIACONTROL_PRODUCT_ROADMAP.md): user-visible change, data
impact, migration, rollback path, tests run, and any manual configuration.

Work packages that are not code — staging provisioning (2), the legal and
privacy sign-off inside 9 and 14, and the pilot itself (15, 16) — are tracked
here only when a code artefact supports them. They are completed by their named
owner, not by a commit.

---

## Package 1 and 3 — Baseline stabilisation and CSV import completion

**Status:** delivered · **Roadmap:** execution order 1 and 3, Stage D

### User-visible change

- `Pilot setup` now confirms a previewed CSV file. Worksites, services, and
  shifts are created in a single transaction; a row that already exists in the
  workspace is reported as skipped, and the first unusable row rolls the entire
  file back so a half-imported workspace cannot happen.
- Re-confirming a byte-identical file replays the recorded outcome instead of
  importing it twice.
- Employee files are confirmed through the existing Supabase invitation
  workflow, one recipient at a time. A profile that cannot be written revokes
  the login that was just created, and the failure is shown against its row.
- Each import kind offers a downloadable template with the exact headers the
  validator expects.

### Data impact

- No schema change.
- New audit actions: `csv_import.confirmed`, `csv_import.rejected`,
  `csv_import.employees_invited`, and `worksite.created` (worksite creation was
  previously unaudited). The confirmed and rejected entries store the per-row
  outcome, and their `entityId` is `KIND:sha256(companyId:kind:file)`, which is
  what makes the replay check possible.

### Migration

None.

### Rollback path

Revert the commit. The audit rows remain valid history; no data written by an
import is removed by the revert, which is intentional — imported worksites,
services, and shifts are ordinary records from that point on.

### Tests

`src/lib/wia-control/imports.test.ts` (10 cases): full-file commit, duplicate
skip, whole-file rollback with the rejection audited outside the transaction,
identical-file replay, refusal of an unvalidated file, refusal of a field worker
and of an employee file on the operational path, employee invitation happy path,
skip of an address that already has an account, login revocation when the
profile write fails while later rows keep processing, and a check that every
shipped template passes the validator that will receive it.

Suite: `npm run lint`, `npm run typecheck`, `npm test` — all green.

### Manual configuration

Employee imports need `SUPABASE_SERVICE_ROLE_KEY` and, for a usable invitation
link, `NEXT_PUBLIC_APP_URL`. Without them the invitation fails per row and is
reported; nothing is written.
