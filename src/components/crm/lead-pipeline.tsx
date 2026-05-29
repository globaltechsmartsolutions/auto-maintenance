import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { leadPipeline } from "@/lib/mock-data";

export function LeadPipeline() {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {leadPipeline.map((stage) => (
        <Card key={stage.status} className="border-border/70 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">{stage.status}</CardTitle>
              <Badge variant="secondary">{stage.count}</Badge>
            </div>
            <p className="text-xl font-semibold">{stage.value}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {stage.leads.map((lead) => (
              <div
                key={lead}
                className="rounded-md border border-border/70 bg-background/55 px-3 py-2 text-sm"
              >
                {lead}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
