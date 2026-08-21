"use client";

import * as React from "react";
import { RefreshCw, ShieldAlert, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Teammate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "MANAGER";
  status: string;
};

const roleTone: Record<Teammate["role"], string> = {
  ADMIN: "border-primary/30 bg-primary/10 text-primary",
  MANAGER: "border-info/30 bg-info/10 text-info",
};

/**
 * Administrators and managers, and the way to invite one.
 *
 * Field workers are the directory below this; the people who coordinate them
 * are a different list with a different rule — only an administrator can add
 * to it. Before this screen existed the only way to create a manager was to
 * write the row into the database by hand.
 */
export function CoordinatorInvite() {
  const [teammates, setTeammates] = React.useState<Teammate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [invited, setInvited] = React.useState<string>();

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/control/team", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "The coordinator list could not be loaded.");
      setTeammates(body.teammates ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The coordinator list could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    setSaving(true);
    setError(undefined);
    setInvited(undefined);
    try {
      const response = await fetch("/api/control/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: String(data.get("firstName") ?? ""),
          lastName: String(data.get("lastName") ?? ""),
          email,
          role: String(data.get("role") ?? "MANAGER"),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "The invitation could not be sent.");
      setOpen(false);
      setInvited(email);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The invitation could not be sent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Coordinators</CardTitle>
          <CardDescription>
            Administrators and managers. They plan and review work; they are not assigned to shifts.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            <UserPlus className="size-4" />
            Invite coordinator
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {invited ? (
          <p className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
            Invitation sent to {invited}. They set their own password from the link in that email —
            nobody else ever sees it.
          </p>
        ) : null}

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading coordinators…</p>
        ) : teammates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No coordinators recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {teammates.map((teammate) => (
              <div
                key={teammate.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/55 p-3"
              >
                <div>
                  <p className="font-medium">
                    {teammate.firstName} {teammate.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{teammate.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={roleTone[teammate.role]}>
                    {teammate.role === "ADMIN" ? "Administrator" : "Manager"}
                  </Badge>
                  {teammate.status !== "ACTIVE" ? (
                    <Badge variant="secondary">{teammate.status.toLowerCase()}</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite a coordinator</DialogTitle>
            <DialogDescription>
              They receive an email and choose their own password. No password is set here, and none
              is ever shown.
            </DialogDescription>
          </DialogHeader>
          <form id="coordinator-form" className="grid gap-4 sm:grid-cols-2" onSubmit={invite}>
            <div className="space-y-2">
              <Label htmlFor="coordinator-first">First name</Label>
              <Input id="coordinator-first" name="firstName" maxLength={80} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coordinator-last">Last name</Label>
              <Input id="coordinator-last" name="lastName" maxLength={80} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="coordinator-email">Email</Label>
              <Input id="coordinator-email" name="email" type="email" maxLength={160} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="coordinator-role">Role</Label>
              <select
                id="coordinator-role"
                name="role"
                defaultValue="MANAGER"
                className="flex h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="MANAGER">Manager — plans shifts and handles incidents</option>
                <option value="ADMIN">Administrator — also settings, exports, and invitations</option>
              </select>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="coordinator-form" disabled={saving}>
              {saving ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
