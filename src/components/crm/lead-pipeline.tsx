"use client";

import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useDemo, type DemoLeadStatus } from "@/components/demo/demo-provider";
import { DemoConfirmActionButton } from "@/components/demo/demo-widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

const statuses: DemoLeadStatus[] = ["Nuevo", "Cualificado", "Presupuesto", "Ganado"];

export function LeadPipeline() {
  const { deleteLead, leads, openDialog, updateLeadStatus } = useDemo();
  const stages = useMemo(
    () =>
      statuses.map((status) => {
        const stageLeads = leads.filter((lead) => lead.status === status);

        return {
          status,
          leads: stageLeads,
          count: stageLeads.length,
          value: stageLeads.reduce((total, lead) => total + lead.value, 0),
        };
      }),
    [leads]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {stages.map((stage) => (
        <Card key={stage.status} className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">{stage.status}</CardTitle>
              <Badge variant="secondary">{stage.count}</Badge>
            </div>
            <p className="text-xl font-semibold">{formatCurrency(stage.value)}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {stage.leads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-md border border-border/70 bg-background/55 px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{lead.companyName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {lead.nextStep}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar lead ${lead.companyName}`}
                      title="Editar lead"
                      onClick={() =>
                        openDialog("lead", {
                          companyName: lead.companyName,
                          contactName: lead.contactName,
                          email: lead.email,
                          id: lead.id,
                          nextStep: lead.nextStep,
                          phone: lead.phone,
                          status: lead.status,
                          tags: lead.tags.join(", "),
                          value: String(lead.value),
                        })
                      }
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DemoConfirmActionButton
                      label={`Borrar lead ${lead.companyName}`}
                      title="¿Borrar este lead?"
                      description="Se eliminará del pipeline comercial. Las reservas o servicios asociados no se borran desde esta acción."
                      onConfirm={() => deleteLead(lead.id)}
                    >
                      <Trash2 className="size-4" />
                    </DemoConfirmActionButton>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(lead.value)} · {lead.contactName}
                </div>
                <select
                  aria-label={`Cambiar estado de ${lead.companyName}`}
                  value={lead.status}
                  onChange={(event) =>
                    updateLeadStatus(lead.id, event.target.value as DemoLeadStatus)
                  }
                  className="mt-3 h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {stage.leads.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
                Sin oportunidades
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
