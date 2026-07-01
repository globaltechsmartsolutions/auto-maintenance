import { Plus } from "lucide-react";
import {
  DemoActionButton,
  DemoPendingWebRequestsPanel,
  DemoServiceHealthCards,
  DemoServicesTable,
} from "@/components/demo/demo-widgets";

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Planificación operativa</p>
          <h1 className="mt-1 text-3xl font-semibold">Servicios</h1>
        </div>
        <DemoActionButton action="new-service">
          <Plus className="size-4" />
          Crear servicio
        </DemoActionButton>
      </div>

      <DemoPendingWebRequestsPanel />
      <DemoServiceHealthCards />

      <DemoServicesTable />
    </div>
  );
}
