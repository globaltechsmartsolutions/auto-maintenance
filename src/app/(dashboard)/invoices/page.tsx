import { Download, FilePlus2, ReceiptText } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { invoices, quotes } from "@/lib/mock-data";
import { formatCurrency, formatDate } from "@/lib/format";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Presupuestos, IVA y PDF</p>
          <h1 className="mt-1 text-3xl font-semibold">Facturación</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <FilePlus2 className="size-4" />
            Presupuesto
          </Button>
          <Button>
            <ReceiptText className="size-4" />
            Factura
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Historial de facturas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.number}</TableCell>
                    <TableCell>{invoice.customer}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>{formatCurrency(invoice.vat)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" aria-label="Descargar PDF">
                        <Download className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Presupuestos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quotes.map((quote) => (
              <div
                key={quote.number}
                className="rounded-md border border-border/70 bg-background/50 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{quote.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {quote.customer}
                    </p>
                  </div>
                  <StatusBadge status={quote.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    válido hasta {formatDate(quote.validUntil)}
                  </span>
                  <span className="font-medium">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
