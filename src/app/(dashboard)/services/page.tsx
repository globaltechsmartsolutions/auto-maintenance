import { CalendarClock, ClipboardList, Plus, ShieldCheck } from "lucide-react";
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
import { serviceHealth, services } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";

const healthIcons = [ClipboardList, CalendarClock, ShieldCheck];

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
        {serviceHealth.map((item, index) => {
          const Icon = healthIcons[index] ?? ClipboardList;

          return (
            <Card key={item.label} className="border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-primary" />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-2xl font-semibold">{item.value}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm text-muted-foreground">{item.helper}</p>
              </CardContent>
            </Card>
          );
        })}
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
