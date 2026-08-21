"use server";

import { redirect } from "next/navigation";
import { hasSupabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function splitFullName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "Administrator";
  const lastName = parts.slice(1).join(" ") || "-";
  return { firstName, lastName };
}

export async function signInAction(formData: FormData) {
  if (isDemoMode()) {
    redirect("/control");
  }

  if (!hasSupabaseConfig()) {
    redirect("/login?error=Authentication%20is%20not%20configured");
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/control");
}

export async function signUpAction(formData: FormData) {
  if (isDemoMode()) {
    redirect("/control");
  }

  if (!hasSupabaseConfig()) {
    redirect("/register?error=Authentication%20is%20not%20configured");
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const companyName = getString(formData, "companyName");
  const fullName = getString(formData, "fullName");

  if (!email || !password || !companyName || !fullName) {
    redirect("/register?error=All%20fields%20are%20required.");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Only display data goes into Supabase user metadata. The role is
      // deliberately NOT stored here: a user can edit their own metadata, so a
      // role read from the token would be a privilege escalation. The role
      // lives in Postgres and is read from there (see api-auth.ts, viewer.ts).
      data: {
        companyName,
        fullName,
      },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  const supabaseUserId = data.user?.id;
  if (!supabaseUserId) {
    redirect("/register?error=Sign-up%20did%20not%20return%20a%20user.");
  }

  const { firstName, lastName } = splitFullName(fullName);

  try {
    await getPrisma().$transaction(async (transaction) => {
      const company = await transaction.company.create({
        data: { name: companyName },
      });

      await transaction.user.create({
        data: {
          companyId: company.id,
          supabaseUserId,
          email,
          firstName,
          lastName,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    });
  } catch (provisioningError) {
    // Roll back the orphaned Supabase Auth user so a retry with the same
    // email does not fail with "user already exists" while having no
    // usable company/profile in Postgres.
    try {
      const admin = createSupabaseAdminClient();
      await admin.auth.admin.deleteUser(supabaseUserId);
    } catch {
      // If cleanup itself fails, surface the original provisioning error;
      // an orphaned auth user is recoverable manually, a hidden failure is not.
    }

    console.error(JSON.stringify({
      level: "error",
      event: "signup.company_provisioning_failed",
      supabaseUserId,
      errorMessage:
        provisioningError instanceof Error ? provisioningError.message : "Unknown error",
    }));

    redirect(
      "/register?error=Could%20not%20create%20the%20company.%20Please%20try%20again."
    );
  }

  // Supabase may require email confirmation before a session exists. If a
  // session was issued immediately, the user goes straight to the app;
  // otherwise they land on login and confirm their email first.
  if (data.session) {
    redirect("/control");
  }

  redirect("/login?message=confirm-email");
}

export async function resetPasswordAction(formData: FormData) {
  if (isDemoMode()) {
    redirect("/login?message=reset-sent");
  }

  if (!hasSupabaseConfig()) {
    redirect("/reset-password?error=Authentication%20is%20not%20configured");
  }

  const email = getString(formData, "email");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=reset-sent");
}

export async function signOutAction() {
  if (isDemoMode()) {
    redirect("/login");
  }

  if (!hasSupabaseConfig()) {
    redirect("/login?error=Authentication%20is%20not%20configured");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}