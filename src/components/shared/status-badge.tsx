import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Active:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Available:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Paid:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Completed:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Accepted:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Won:
    "border-success/30 bg-success/10 text-success dark:bg-success/15 dark:text-success",
  Scheduled: "border-info/30 bg-info/10 text-info dark:bg-info/15 dark:text-info",
  New: "border-info/30 bg-info/10 text-info dark:bg-info/15 dark:text-info",
  Qualified: "border-info/30 bg-info/10 text-info dark:bg-info/15 dark:text-info",
  Pending:
    "border-warning/30 bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning",
  Quote:
    "border-warning/30 bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning",
  Sent:
    "border-warning/30 bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning",
  Draft:
    "border-muted-foreground/25 bg-muted text-muted-foreground",
  "In progress": "border-info/30 bg-info/10 text-info dark:bg-info/15 dark:text-info",
  "Follow-up":
    "border-warning/30 bg-warning/15 text-warning dark:bg-warning/15 dark:text-warning",
  Overdue:
    "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/15",
  "Past due":
    "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/15",
  Paused:
    "border-muted-foreground/25 bg-muted text-muted-foreground",
  Cancelled:
    "border-muted-foreground/25 bg-muted text-muted-foreground",
  Trial:
    "border-accent/40 bg-accent/30 text-accent-foreground dark:text-foreground",
};

const statusLabels: Record<string, string> = {
  Active: "Active",
  Available: "Available",
  Paid: "Paid",
  Completed: "Completed",
  Accepted: "Accepted",
  Won: "Won",
  Scheduled: "Scheduled",
  New: "New",
  Qualified: "Qualified",
  Pending: "Pending",
  Quote: "Quote",
  Sent: "Sent",
  Draft: "Draft",
  "In progress": "In progress",
  "Follow-up": "Follow-up",
  Overdue: "Past due",
  Paused: "Paused",
  Cancelled: "Cancelled",
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
      {statusLabels[status] ?? status}
    </Badge>
  );
}
