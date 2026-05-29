"use server";

import { redirect } from "next/navigation";
import { hasSupabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(formData: FormData) {
  if (isDemoMode() || !hasSupabaseConfig()) {
    redirect("/dashboard");
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

  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  if (isDemoMode() || !hasSupabaseConfig()) {
    redirect("/dashboard");
  }

  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const companyName = getString(formData, "companyName");
  const fullName = getString(formData, "fullName");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        companyName,
        fullName,
        role: "ADMIN",
      },
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function resetPasswordAction(formData: FormData) {
  if (isDemoMode() || !hasSupabaseConfig()) {
    redirect("/login?message=reset-sent");
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
  if (isDemoMode() || !hasSupabaseConfig()) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
