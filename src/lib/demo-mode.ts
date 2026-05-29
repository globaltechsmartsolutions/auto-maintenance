export function isDemoMode() {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true"
  );
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasStripeConfig() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
