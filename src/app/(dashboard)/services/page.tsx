import { CalendarClock, ClipboardList, Plus } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { services } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Planificación operativa</p>
          <h1 className="mt-1 text-3xl font-semibold">Servicios</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="scheduled">Programados</SelectItem>
              <SelectItem value="progress">En curso</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Plus className="size-4" />
            Crear servicio
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-primary" />
              Recurrentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">238</p>
            <p className="text-sm text-muted-foreground">contratos activos</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" />
              Puntuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">74</p>
            <p className="text-sm text-muted-foreground">servicios este mes</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Ticket medio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(864)}</p>
            <p className="text-sm text-muted-foreground">IVA no incluido</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Listado de servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Recurrencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="font-medium">{service.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(service.start)} · {service.city}
                    </div>
                  </TableCell>
                  <TableCell>{service.customer}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{service.recurrence}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={service.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {service.team.join(", ")}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(service.price * (1 + service.vatRate / 100))}
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
