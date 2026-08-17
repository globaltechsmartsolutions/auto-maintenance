import { Activity, Building2, CreditCard, TrendingDown, Users } from "lucide-react";
import { DemoActionButton } from "@/components/demo/demo-widgets";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminCompanies } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/format";

export default function AdminPage() {
  const mrr = adminCompanies.reduce((total, company) => total + company.mrr, 0);
  const users = adminCompanies.reduce((total, company) => total + company.users, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Super admin SaaS</p>
          <h1 className="mt-1 text-3xl font-semibold">Platform dashboard</h1>
        </div>
        <DemoActionButton action="analytics" variant="outline">
          <Activity className="size-4" />
          Analytics
        </DemoActionButton>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-primary" />
              MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(mrr)}</p>
            <p className="text-sm text-muted-foreground">ingreso recurrente</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Companys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{adminCompanies.length}</p>
            <p className="text-sm text-muted-foreground">active workspaces</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{users}</p>
            <p className="text-sm text-muted-foreground">licencias creadas</p>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4 text-primary" />
              Churn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">2.1%</p>
            <p className="text-sm text-muted-foreground">last 90 days</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Companies and subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Churn risk</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminCompanies.map((company) => (
                  <TableRow key={company.name}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.plan}</TableCell>
                    <TableCell>
                      <StatusBadge status={company.status} />
                    </TableCell>
                    <TableCell>{company.users}</TableCell>
                    <TableCell>{company.churnRisk}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(company.mrr)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
