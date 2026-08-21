import Link from "next/link";
import { Smartphone } from "lucide-react";
import { CoordinatorInvite } from "@/components/control/coordinator-invite";
import { EmployeeDirectory } from "@/components/control/employee-directory";
import { Button } from "@/components/ui/button";
import { getDashboardViewer } from "@/lib/auth/viewer";

export default async function EmployeesPage() {
  const viewer = await getDashboardViewer();
  // Only an administrator can invite one, so only an administrator is shown
  // the list. A manager coordinating work has no reason to see it.
  const canInviteCoordinators = ["SUPER_ADMIN", "ADMIN"].includes(viewer.role);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">People and performance</p>
          <h1 className="mt-1 text-3xl font-semibold">Employees</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/employee">
              <Smartphone className="size-4" />
              Employee view
            </Link>
          </Button>
        </div>
      </div>

      {canInviteCoordinators ? <CoordinatorInvite /> : null}

      <EmployeeDirectory />
    </div>
  );
}