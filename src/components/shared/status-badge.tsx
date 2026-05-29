import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Activo:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Disponible:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Pagada:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Completado:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Programado: "border-info/30 bg-info/10 text-info dark:bg-info/15 dark:text-info",
  Pendiente:
    "border-warning/30 bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning",
  "En curso": "border-info/30 bg-info/10 text-info dark:bg-info/15 dark:text-info",
  "En seguimiento":
    "border-warning/30 bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning",
  Vencida:
    "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/15",
  "Past due":
    "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/15",
  Pausado:
    "border-muted-foreground/25 bg-muted text-muted-foreground",
  Trial:
    "border-accent/40 bg-accent/30 text-accent-foreground dark:text-foreground",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 rounded-md px-2.5", statusStyles[status], className)}
    >
      {status}
    </Badge>
  );
}
