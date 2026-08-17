# Pre-production Readiness Report

**Date:** May 29, 2026
**Branch:** `feature/preproduction-infrastructure`

## Prepared work

The assigned technical pre-production work has been completed without using real
secrets or breaking the local demo.

## Changes

### Database

- Added an idempotent seed in `prisma/seed.mjs`.
- Added `npm run db:seed`.
- Added `npm run db:migrate:deploy`.
- Added `npm run preprod:verify`.

The seed loads enough data to demonstrate the product against real PostgreSQL.

### Authentication and security

- Middleware protects private routes when Supabase is configured and
  `DEMO_MODE=false`.
- Public authentication routes remain available.
- Authenticated users who open `/login` are redirected to `/dashboard`.
- Anonymous users who open a private route are redirected to `/login`.

### API roles

Initial role protection covers leads, services, invoices, and automation reminders.
Demo mode continues to return mock data so the local demo remains functional.

### Environment variables

- `.env.example` documents PostgreSQL, Supabase, and Stripe test variables.
- `STRIPE_PRICE_PRO` is supported as a possible pre-production alias.

## Work requiring credentials

This environment cannot:

- Create the real Supabase project or users.
- Run migrations or seed against a real pre-production database.
- Create Stripe test products/prices or configure a webhook.
- Create or verify a real Vercel preview URL.

## Verification commands

```bash
npm run preprod:verify
npm run lint
npx prisma validate
npm run build
npm audit --omit=dev
node --check prisma/seed.mjs
```

Run `preprod:verify` with the local server stopped to avoid conflicts with generated
`.next` artifacts.

## Next operational steps

1. Configure Supabase.
2. Configure Vercel environment variables.
3. Deploy database migrations.
4. Run the seed when appropriate.
5. Create Supabase Auth users and associate `supabaseUserId` with `User`.
6. Create Stripe test products/prices.
7. Configure the Stripe webhook.
8. Test the preview URL.
