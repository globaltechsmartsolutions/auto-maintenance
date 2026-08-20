import Link from "next/link";
import { Smartphone } from "lucide-react";
import { EmployeeDirectory } from "@/components/control/employee-directory";
import { Button } from "@/components/ui/button";

export default function EmployeesPage() {
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

      <EmployeeDirectory />
    </div>
  );
}