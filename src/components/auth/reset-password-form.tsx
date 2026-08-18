"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResetPasswordFormProps = {
  requestAction: (formData: FormData) => void | Promise<void>;
  initialError?: string;
};

export function ResetPasswordForm({ requestAction, initialError }: ResetPasswordFormProps) {
  const router = useRouter();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(initialError);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setRecoveryMode(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted && (event === "PASSWORD_RECOVERY" || Boolean(session))) {
        setRecoveryMode(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword() {
    setError(undefined);
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/login?message=password-updated");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border/70 bg-card/90 shadow-xl">
        <CardHeader className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl leading-snug font-medium">
              {recoveryMode ? "Choose a new password" : "Reset password"}
            </h1>
            <CardDescription className="mt-2">
              {recoveryMode
                ? "Set a new password to restore access to your WIAControl account."
                : "We will send you a secure link to restore access."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="size-4" />
              <AlertTitle>Unable to continue</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {recoveryMode ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void updatePassword();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button className="w-full" size="lg" disabled={saving}>
                {saving ? "Saving..." : "Save new password"}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          ) : (
            <form action={requestAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" name="email" type="email" placeholder="admin@company.com" required />
              </div>
              <Button className="w-full" size="lg">
                Send link
                <ArrowRight className="size-4" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
