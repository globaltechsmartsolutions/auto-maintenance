# QA round 1 — response and evidence

**Round run:** 21 August 2026, against staging, on the fictional company
`Northstar Facility Services - QA 2026-08-21`.
**Reported:** 19 checks passed, 7 issues raised.
**Outcome:** all 7 issues resolved. One of them was a missing feature rather
than a defect.

---

## First, the QA itself

The 19 passes were cross-checked against the staging database rather than taken
on trust. They hold up: 4 clock events forming a complete in / break / break /
out cycle, 2 attendance incidents opened by the detector, 3 shifts, 2 worksites,
6 accounts. No pass was claimed that the data does not support.

Two things the round did that are worth keeping: it used the checklist's own
identifiers rather than a private numbering, and it separated "this failed" from
"I think this is the wrong approach" (issue 1). Both made this response
possible.

---

## The headline finding

**Issues 2, 3 and 4 were one missing feature, not three defects.**

Nothing in the product could create a `Customer`. No API route, no service
function. The table exists, worksites and services reference it, the register
can be listed and linked — but a workspace starting from nothing could never
get its first row. The `/crm` screen looked like the place, but it reads the
demo provider and writes nowhere, and it sits behind a commercial flag that is
off for every real company.

Confirmed in staging before any change: **zero customers across all three
companies**, including one with three days of testing behind it.

That single gap produced all three symptoms, and blocked eight checklist checks
(8, 9, 12, 13, 14, 20, 21, 46).

---

## Issue by issue

### 1 · Managers had to be created with SQL — **fixed**

**Reported:** creating a manager by hand is not a good approach; an
administrator should be able to do it.

**Cause:** `employeeCreateSchema` has no role, and the invitation path always
writes `EMPLOYEE`. The only account the product could create was a field
worker.

**Changed:**
- `createTeammateProfile` and `POST` / `GET` `/api/control/team`, mirroring the
  employee invitation including the login rollback, so a failed profile write
  does not strand a Supabase user that blocks the retry.
- Only an administrator may invite, and only `ADMIN` or `MANAGER` may be
  granted. A manager minting an administrator would make the two roles
  decorative; `SUPER_ADMIN` reaches across companies so it cannot be granted
  from inside one.
- A **Coordinators** panel on the team page, shown to administrators only. The
  invited person sets their own password from the emailed link. No password is
  chosen in the product and none is ever displayed.

**Evidence:** 8 unit tests, including both refusals (manager inviting anyone,
field worker inviting anyone) and the audit entry recording which role was
granted. Commit `21b99e3`.

**Note beyond the fix:** the manual `INSERT` used to work around this carried a
live database password, which then travelled through a shared QA document. A
missing screen became a rotated credential. That rotation is still outstanding.

---

### 2 · Worksite customer field not saved — **fixed**

**Reported:** the Customer field is present but is not stored, and it is
required.

**Cause:** two faults stacked.
1. The field was **free text**, required, collecting a client *name*
   ([worksites-dashboard.tsx](../src/components/control/worksites-dashboard.tsx)).
   The API links a worksite by identifier, so no spelling could ever have
   worked. What the screenshot shows in the box is the placeholder, not a
   value — which is also why the browser reported the field as empty.
2. `addWorksite` built the request body by hand and **left the field out
   entirely** ([wia-control-provider.tsx](../src/components/control/wia-control-provider.tsx)),
   so the value never left the browser.

**Changed:** the field is now an optional selector over the real client
register, and `customerId` is sent on both create and update.

**Evidence:** both Northstar worksites were in staging with `customerId` NULL,
which is the fault reproduced in data. Commit `5a0860d`.

---

### 3 · "Create service" permanently disabled — **fixed**

**Reported:** the button is disabled on the Services page.

**Cause:** `disabled={customers.length === 0}` — deliberate, because a service
is delivered to somebody. With no way to create a client it could never
re-enable, and it explained nothing.

**Changed:** a **New client** button beside it, and when no client exists the
page states why the other button is off instead of presenting a dead control.

**Evidence:** commit `5a0860d`.

---

### 4 · "Add a customer" lands on Coverage — **fixed**

**Reported:** the Pilot setup step redirects to the Coverage page.

**Cause:** the step linked to `/crm`; `/crm` redirects to `/control` when the
commercial flag is off, and `/control` is Coverage. Not a mistyped link — a
link to a feature that did not exist.

**Changed:** the step points at `/services`, where clients are now recorded.

**Evidence:** commit `5a0860d`.

---

### 5 · No sign-out on the employee screen — **fixed**

**Reported:** the employee page has no logout option.

**Cause:** the only `signOut` in the project is in the dashboard shell, which
that screen does not use.

**Why this was treated as an integrity fault, not a convenience one:** field
devices are shared. Without a way to end the session, the next person to pick
up the phone clocks in as whoever used it last, and the attendance record then
names the wrong person — the one thing that record exists to get right.

**Changed:** a plain **Sign out** button in the header, deliberately not hidden
in a menu. It has to be findable by someone standing in a doorway holding a
mop.

**Evidence:** commit `21b99e3`.

---

### 6 · Suspended account sees `access_denied` — **fixed (message only)**

**Reported:** a banned user cannot set a password and sees an access denied
error.

**Assessment:** the **behaviour is correct**. If a suspended account could
recover access through the password flow, the suspension would be worthless.
What was wrong was showing Supabase's machine code to a person.

**Changed:** the recovery screen translates the codes into what happened and
what to do — a suspended account, an expired link, and an invalid link each get
their own sentence. Nothing reveals whether an address has an account.

**Evidence:** commit below.

---

### 7 · Overlap message not shown properly — **fixed, and it was general**

**Reported:** the overlap message does not appear correctly when creating an
overlapping shift.

**Cause:** two layers.
1. The client-side overlap check only inspects the shifts the browser has
   loaded, so a conflict outside the visible range does not trigger it.
2. The real fault: every mutation ran as
   `void runRemoteMutation(...); return true;` — **the interface reported
   success before the server had answered.** The dialog closed as though the
   shift had been created, and the rejection arrived afterwards as a toast
   titled "The operation could not be completed".

This was never specific to overlaps. It applied to every server rejection in
every form.

**Changed:** the five operations whose result the interface acts on — planning
a shift, assigning one, confirming a replacement, archiving a worksite,
requesting a time correction — now return the server's answer, and their call
sites await it. A dialog closes when the write succeeded, not when it was sent.

**Also:** the fallback text of that notification was in Spanish inside an
English interface. Corrected.

**Evidence:** commit below.

---

## Verification

| Gate | Result |
| --- | --- |
| Lint | clean, zero warnings |
| Type check | clean |
| Unit tests | **419 passing**, 32 files |
| Coverage thresholds | passing (ratchet at 85 / 73 / 87 / 85) |
| Integration tests | 24 passing against real PostgreSQL |
| Production build | succeeds; `/api/control/customers` and `/api/control/team` present |

Sixteen tests were added for the two new rules — recording a client and
inviting a coordinator — covering the tenant scoping, both refusals, the audit
entries, and the duplicate-name rule.

**Not yet verified by hand in a browser.** Every fix above is covered by tests
or reproduced in data, but the six screens involved have not been clicked
through end to end. That is the next step and it needs a decision first: the
local application writes to the same staging database the QA round is using.

---

## What this round changes for the checklist

**Unblocked** — checks 8, 9, 12, 13, 14, 20, 21 and 46 can now be run. They
were impossible before, not failing.

**Worth adding** — the round exposed two gaps in the checklist itself:
- Nothing covered creating a coordinator account, which is why the missing
  feature reached QA.
- Nothing covered a worker signing out.

---

## Still outstanding, and not a code change

**The database password in the QA document must be rotated.** The `psql`
command recorded in the round carries the full Supabase connection string
including the password, giving write access to every company, every clock
event, and the audit log. It has been in a shared document; it can no longer be
treated as secret.

Supabase → Settings → Database → Reset database password, then update
`.env.local` and the deployment environment.
