import { Plus } from "lucide-react";
import {
  DemoActionButton,
  DemoAutomationsWorkspace,
} from "@/components/demo/demo-widgets";

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Emails, SMS y seguimiento</p>
          <h1 className="mt-1 text-3xl font-semibold">Automatizaciones</h1>
        </div>
        <DemoActionButton action="new-automation">
          <Plus className="size-4" />
          Nueva automatización
        </DemoActionButton>
      </div>

      <DemoAutomationsWorkspace />
    </div>
  );
}
