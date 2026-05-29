import { Bot, Mail, MessageSquareText, Plus, Star } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { automations } from "@/lib/mock-data";

const triggerIcons = {
  SERVICE_REMINDER: Bot,
  SERVICE_CONFIRMATION: Mail,
  FOLLOW_UP: MessageSquareText,
  REVIEW_REQUEST: Star,
  FAILED_PAYMENT: Mail,
} as const;

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Emails, SMS y seguimiento</p>
          <h1 className="mt-1 text-3xl font-semibold">Automatizaciones</h1>
        </div>
        <Button>
          <Plus className="size-4" />
          Nueva automatización
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {automations.map((automation) => {
          const Icon =
            triggerIcons[automation.trigger as keyof typeof triggerIcons] ?? Bot;

          return (
            <Card key={automation.name} className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-4 text-primary" />
                  {automation.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={automation.status} />
                  <Switch defaultChecked={automation.status === "Activo"} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-border/70 bg-background/50 p-3">
                    <p className="text-muted-foreground">Envíos</p>
                    <p className="mt-1 font-semibold">{automation.sent}</p>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/50 p-3">
                    <p className="text-muted-foreground">Conversión</p>
                    <p className="mt-1 font-semibold">{automation.conversion}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Reglas activas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Disparador</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Conversión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((automation) => (
                <TableRow key={automation.name}>
                  <TableCell className="font-medium">{automation.name}</TableCell>
                  <TableCell>{automation.trigger}</TableCell>
                  <TableCell>{automation.channel}</TableCell>
                  <TableCell>
                    <StatusBadge status={automation.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {automation.conversion}
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
