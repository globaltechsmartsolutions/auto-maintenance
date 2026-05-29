import { Download, FileText, Plus, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { invoices, services } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";

export default function PortalPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Vista de cliente final</p>
          <h1 className="mt-1 text-3xl font-semibold">Portal cliente</h1>
        </div>
        <Button>
          <Plus className="size-4" />
          Solicitar servicio
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              Acceso cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="text-xl font-semibold">Atrium Labs</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-border/70 bg-background/50 p-3">
                <p className="text-muted-foreground">Facturas</p>
                <p className="mt-1 text-lg font-semibold">3</p>
              </div>
              <div className="rounded-md border border-border/70 bg-background/50 p-3">
                <p className="text-muted-foreground">Servicios</p>
                <p className="mt-1 text-lg font-semibold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Servicios visibles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {services.slice(0, 3).map((service) => (
                <div
                  key={service.id}
                  className="rounded-md border border-border/70 bg-background/50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{service.title}</p>
                    <StatusBadge status={service.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDate(service.start)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{invoice.number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(invoice.total)}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Descargar">
                    <Download className="size-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
