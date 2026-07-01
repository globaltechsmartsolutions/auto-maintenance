import { FilePlus2, ReceiptText } from "lucide-react";
import {
  DemoActionButton,
  DemoInvoicesWorkspace,
} from "@/components/demo/demo-widgets";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Presupuestos, IVA y PDF</p>
          <h1 className="mt-1 text-3xl font-semibold">Facturación</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DemoActionButton action="new-quote" variant="outline">
            <FilePlus2 className="size-4" />
            Presupuesto
          </DemoActionButton>
          <DemoActionButton action="new-invoice">
            <ReceiptText className="size-4" />
            Factura
          </DemoActionButton>
        </div>
      </div>

      <DemoInvoicesWorkspace />
    </div>
  );
}
