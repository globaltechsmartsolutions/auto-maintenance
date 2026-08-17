import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  delta,
  helper,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  delta: string;
  helper: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <Card className="h-full min-h-[166px] overflow-hidden border-border/70 bg-card/85 shadow-sm">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="min-h-8 text-xs font-medium uppercase leading-4 text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md border",
              tone === "success" &&
                "border-success/25 bg-success/10 text-success",
              tone === "warning" &&
                "border-warning/25 bg-warning/10 text-warning",
              tone === "default" && "border-border bg-secondary text-foreground"
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
          <span className="font-medium text-primary">{delta}</span>
          <span className="truncate text-muted-foreground">{helper}</span>
        </div>
      </CardContent>
    </Card>
  );
}
