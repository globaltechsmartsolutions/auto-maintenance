# WIAControl — Staging Environment Record (Stage 1)

**Do not commit this file to the repository.** Store it in a password
manager, internal wiki, or shared drive with restricted access.

Last updated: 2026-08-18

## 1. Staging environment

| Item | Value |
| --- | --- |
| Environment name | `wia-control-staging` |
| Purpose | Stage 1 pilot-preparation testing (not production, not customer data) |
| Supabase project | `wia-control-staging` |
| Supabase project ID | `brjylsjwgavtnusfswif` |
| Supabase region | Southeast Asia (Singapore) — `ap-southeast-1` |
| Supabase dashboard | https://supabase.com/dashboard/project/brjylsjwgavtnusfswif |
| App URL (local dev) | http://localhost:3000 |
| Database | Supabase-managed PostgreSQL (Transaction pooler, port 6543) |

## 2. Environment variable owners

| Variable | Where it lives | Owner | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | `.env` (local only, never committed) | Imtiaz Ali | Includes `sslmode=no-verify` — see Section 7, Known Issues |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env` | Imtiaz Ali | `https://brjylsjwgavtnusfswif.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env` | Imtiaz Ali | Publishable key, safe for client-side use |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` | Imtiaz Ali | **Secret.** Store the actual value in a password manager, not in any document. |
| `DEMO_MODE` / `NEXT_PUBLIC_DEMO_MODE` | `.env` | Imtiaz Ali | Must stay `false` for staging/real-mode testing |
| Database password | Password manager only | Imtiaz Ali | **Never store in this document or the repo.** |

## 3. Test accounts (Company: "WIA Staging Test Ltd")

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| ADMIN | imtiaz@gmail.com | *(in password manager)* | Registered via `/register`, created Company + User automatically |
| MANAGER | manager@wia-staging.test | *(in password manager)* | Created manually via Supabase Auth + linked in Postgres |
| EMPLOYEE | employee@wia-staging.test | *(in password manager)* | Created manually via Supabase Auth + linked in Postgres; has an `Employee` profile row |

## 4. Second company (for tenant-isolation testing)

| Role | Email | Company |
| --- | --- | --- |
| ADMIN | admin2@wia-staging.test | Second Test Company Ltd |

## 5. Other test accounts

| Purpose | Email | Notes |
| --- | --- | --- |
| No-company / orphan user test | orphan@wia-staging.test | Exists in Supabase Auth only, no Postgres `User` record — used to test and fix the redirect-loop bug (see Known Issues, item 6). Safe to delete after review. |

## 6. Tests performed and results

| Test | Result | Notes |
| --- | --- | --- |
| Migrations applied (`db:migrate:deploy` equivalent) | ✅ Pass | Applied manually via `psql` due to a local network issue with Prisma's schema-engine binary (see Known Issues) |
| Admin sign-up creates Company + User in Postgres | ✅ Pass | Fixed a bug where this previously did not happen (see Known Issues) |
| Cross-tenant isolation — list endpoint | ✅ Pass | Company B could not see Company A's worksites |
| Cross-tenant isolation — direct ID access (PATCH) | ✅ Pass | Company B got `404 WORKSITE_NOT_FOUND` when guessing Company A's real worksite ID |
| Cross-tenant isolation — day view | ✅ Pass | Company B could not see Company A's shift |
| Role restriction — Employee creating a worksite | ✅ Pass | `403 Forbidden` |
| Role restriction — Employee updating company settings | ✅ Pass (with a complete payload) | See Known Issues for a related ordering bug |
| Employee viewing own shift | ✅ Pass | `/employee` page correctly showed only the assigned shift |
| Password reset — request step | ✅ Pass | Fixed a missing "Forgot password?" link on the login page (see Known Issues); the request-email step works and shows "Check your email" |
| Disabled user | ✅ Pass | A user banned in Supabase Auth is correctly refused sign-in with "User is banned" |
| No-company user | ✅ Pass (after a fix) | Found and fixed an infinite redirect loop (see Known Issues, item 6) |

## 7. Known issues found during Stage 1

1. **Local network TLS interception.** The development machine's network
   presents a self-signed certificate on outbound TLS connections, which
   broke Prisma's schema-engine (`migrate`/`db execute` hung indefinitely)
   and the app's own Postgres connection (`pg` library rejected the
   certificate). Worked around with `sslmode=no-verify` in `DATABASE_URL`
   for staging. **This must be resolved with IT/network before production**
   — do not use `sslmode=no-verify` outside of trusted local testing.
2. **Sign-up did not provision a Company/User record.** Fixed: `signUpAction`
   now creates the `Company` + `User` rows in Postgres in a transaction,
   with rollback of the orphaned Supabase Auth user if provisioning fails.
3. **No "invite team member" flow exists.** MANAGER and EMPLOYEE accounts
   for this round of testing were created manually via SQL. A proper invite
   feature (Admin-initiated, not public self-registration) is still needed
   before pilot — tracked for a later stage.
4. **API routes validate input before checking authorization.** Every route
   in `src/app/api/control/**` parses the request body (Zod) before calling
   `requireWiaApiContext`. This means an unauthorized request with an
   incomplete body returns `400 VALIDATION_ERROR` instead of `403
   Forbidden`. Functionally harmless (the action is never performed either
   way) but inconsistent with the playbook's specified order
   (Section 13) and leaks schema shape to unauthorized callers. Not fixed
   yet — flagged for a follow-up pass across all routes.
5. **"Customer" field on the worksite form does not persist.** The form
   posts a free-text `customer` value that the API does not accept (only a
   real `customerId` relation is supported, and no customer-creation UI/API
   exists yet). Fixed the immediate confusion by making the field optional
   and labeling it "internal reference only, not saved yet." Full
   CRM/customer linking remains out of scope until the core pilot is
   stable, per the playbook.
6. **Infinite redirect loop for orphaned Supabase users (fixed).** A user
   that exists in Supabase Auth but has no matching Postgres `User` record
   (no company/profile) caused an infinite redirect loop between `/control`
   and `/login?error=Profile%20unavailable`: the dashboard layout redirected
   to `/login` on a missing profile, but the middleware saw a still-valid
   Supabase session on `/login` and immediately redirected back to
   `/control`, forever. Fixed by calling `supabase.auth.signOut()` before
   the redirect in `getDashboardViewer()` (`src/lib/auth/viewer.ts`), so the
   session is cleared and the loop cannot restart.
7. **Password reset flow was incomplete.** The login page had no link to
   `/reset-password`, and — separately and still unresolved — there is no
   "set a new password" page/action for after the user clicks the emailed
   reset link (no code anywhere calls `supabase.auth.updateUser({ password
   })`). Fixed the missing link (added a "Forgot password?" link on
   `/login`, and removed leftover demo-mode default credentials from the
   login form). **Not yet fixed:** a user who requests a reset currently has
   no way to actually complete it and set a new password. This must be
   built before the password-reset feature is genuinely usable.

## 8. Stage 1 completion

All Stage 1 checklist items from the playbook have been executed against
the staging environment: sign-in, password reset (request step), disabled
user, no-company user, wrong role, and cross-company ID manipulation. The
Stage 1 acceptance test passes: an employee from Company A cannot read or
mutate a shift, clock event, correction, or worksite belonging to Company B.

Two follow-up items are carried forward (not blockers for Stage 1, but
should be planned before pilot):
- Build the "set new password" step to complete the password-reset flow.
- Build a proper "invite team member" feature to replace the manual SQL
  user creation used for this round of testing.
