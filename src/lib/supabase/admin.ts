import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Admin client using the Supabase service role key.
 *
 * This bypasses Row Level Security and must never be exposed to the browser.
 * Use it only for privileged, server-side operations such as cleaning up an
 * orphaned auth user when company/profile provisioning fails after sign-up.
 */
export function createSupabaseAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}