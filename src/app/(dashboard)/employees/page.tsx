import Link from "next/link";
import { NotebookPen, Plus, Smartphone, UserRoundCheck } from "lucide-react";
import {
  DemoActionButton,
  DemoEmployeesTable,
} from "@/components/demo/demo-widgets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Personas y rendimiento</p>
          <h1 className="mt-1 text-3xl font-semibold">Empleados</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/empleado">
              <Smartphone className="size-4" />
              Vista empleado
            </Link>
          </Button>
          <DemoActionButton action="new-employee">
            <Plus className="size-4" />
            Nuevo empleado
          </DemoActionButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRoundCheck className="size-4 text-primary" />
              Disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">27</p>
            <p className="text-sm text-muted-foreground">para nuevas visitas</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Media de rendimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">92/100</p>
            <Progress value={92} className="mt-3" />
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="size-4 text-primary" />
              Notas internas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">14</p>
            <p className="text-sm text-muted-foreground">actualizadas esta semana</p>
          </CardContent>
        </Card>
      </div>

      <DemoEmployeesTable />
    </div>
  );
}
