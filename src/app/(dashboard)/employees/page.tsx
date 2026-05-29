import { NotebookPen, Plus, UserRoundCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { employees } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Personas y rendimiento</p>
          <h1 className="mt-1 text-3xl font-semibold">Empleados</h1>
        </div>
        <Button>
          <Plus className="size-4" />
          Nuevo empleado
        </Button>
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

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Equipo de campo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Disponibilidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Rendimiento</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {employee.role}
                    </div>
                  </TableCell>
                  <TableCell>{employee.availability}</TableCell>
                  <TableCell>
                    <StatusBadge status={employee.status} />
                  </TableCell>
                  <TableCell>{employee.jobs}</TableCell>
                  <TableCell className="min-w-36">
                    <div className="flex items-center gap-3">
                      <Progress value={employee.score} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {employee.score}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(employee.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
