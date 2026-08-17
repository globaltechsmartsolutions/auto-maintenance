import { Building2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardViewer } from "@/lib/auth/viewer";

export default async function ProfilePage() {
  const viewer = await getDashboardViewer();
  const roleLabel = {
    SUPER_ADMIN: "Super administrator",
    ADMIN: "Administrator",
    MANAGER: "Coordinator",
    EMPLOYEE: "Employee",
  }[viewer.role];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Account and permissions</p>
        <h1 className="mt-1 text-3xl font-semibold">My profile</h1>
      </div>
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <UserRound className="size-6" />
            </span>
            <div>
              <CardTitle className="text-xl">{viewer.userName}</CardTitle>
              <Badge variant="outline" className="mt-2 border-primary/30 bg-primary/10 text-primary">
                {roleLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/45 p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <Building2 className="size-3.5" />
              Company
            </p>
            <p className="mt-2 font-medium">{viewer.companyName}</p>
          </div>
          <div className="rounded-lg bg-muted/45 p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Access
            </p>
            <p className="mt-2 font-medium">Protected by Supabase Auth</p>
          </div>
          <div className="rounded-lg bg-muted/45 p-4 sm:col-span-2">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <Mail className="size-3.5" />
              Account support
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Identity and email changes are managed through the authentication provider to preserve the audit trail.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
