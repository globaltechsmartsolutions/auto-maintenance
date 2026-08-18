"use client";

import * as React from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Plus,
  Search,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import {
  useWiaControl,
  type PlannedShift,
  type ShiftStatus,
} from "@/components/control/wia-control-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const statusConfig: Record<ShiftStatus, { label: string; className: string }> = {
  PLANNED: { label: "Planned", className: "border-info/30 bg-info/10 text-info" },
  ACTIVE: { label: "In progress", className: "border-success/30 bg-success/10 text-success" },
  PAUSED: { label: "Paused", className: "border-warning/30 bg-warning/10 text-warning" },
  COMPLETED: { label: "Completed", className: "border-success/30 bg-success/10 text-success" },
  UNCOVERED: { label: "Uncovered", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  COVERED: { label: "Covered", className: "border-primary/30 bg-primary/10 text-primary" },
  CANCELLED: { label: "Cancelled", className: "border-border bg-muted text-muted-foreground" },
};

const employeeStatusLabels = {
  AVAILABLE: "Available",
  ASSIGNED: "Assigned",
  VACATION: "Holiday",
  SICK_LEAVE: "Sick leave",
  INACTIVE: "Inactive",
} as const;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    weekday: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${value}T12:00:00+02:00`));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function ShiftDialog({
  open,
  onOpenChange,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
}) {
  const { addShift, employees, worksites } = useWiaControl();
  const activeWorksites = worksites.filter((worksite) => worksite.isActive !== false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date") ?? defaultDate);
    const employeeName = String(data.get("employeeName") ?? "").trim() || undefined;
    const created = addShift({
      worksiteId: String(data.get("worksiteId") ?? ""),
      title: String(data.get("title") ?? "").trim(),
      employeeName,
      startsAt: `${date}T${String(data.get("startsAt") ?? "09:00")}:00+02:00`,
      endsAt: `${date}T${String(data.get("endsAt") ?? "11:00")}:00+02:00`,
      requiredSkills: String(data.get("requiredSkills") ?? "")
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    });
    if (created) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Plan shift</DialogTitle>
          <DialogDescription>
            WIA will check availability and overlaps before adding it to the plan.
          </DialogDescription>
        </DialogHeader>
        <form id="shift-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shift-title">Service or task</Label>
            <Input
              id="shift-title"
              name="title"
              placeholder="Opening clean"
              minLength={2}
              maxLength={160}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-worksite">Worksite</Label>
            <select
              id="shift-worksite"
              name="worksiteId"
              defaultValue={activeWorksites[0]?.id}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              required
            >
              {activeWorksites.map((worksite) => (
                <option key={worksite.id} value={worksite.id}>
                  {worksite.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-employee">Assignee</Label>
            <select
              id="shift-employee"
              name="employeeName"
              defaultValue=""
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.name}>
                  {employee.name} · {employeeStatusLabels[employee.status]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-date">Date</Label>
            <Input id="shift-date" name="date" type="date" defaultValue={defaultDate} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="shift-start">Start</Label>
              <Input id="shift-start" name="startsAt" type="time" defaultValue="09:00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift-end">End</Label>
              <Input id="shift-end" name="endsAt" type="time" defaultValue="11:00" required />
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shift-skills">Required Skills</Label>
            <Input
              id="shift-skills"
              name="requiredSkills"
              placeholder="offices, windows, maquinaria"
            />
            <p className="text-xs text-muted-foreground">Separate them with commas.</p>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="shift-form" disabled={activeWorksites.length === 0}>
            Plan shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ShiftRow({ shift }: { shift: PlannedShift }) {
  const { assignShift, cancelShift, employees, worksites } = useWiaControl();
  const worksite = worksites.find((item) => item.id === shift.worksiteId);
  const status = statusConfig[shift.status];

  return (
    <div
      className={cn(
        "grid gap-4 rounded-lg border border-border/70 bg-background/55 p-4 lg:grid-cols-[130px_1.2fr_1fr_auto] lg:items-center",
        shift.status === "UNCOVERED" && "border-destructive/30 bg-destructive/[0.035]",
        shift.status === "CANCELLED" && "opacity-60"
      )}
    >
      <div>
        <p className="text-lg font-semibold tabular-nums">
          {formatTime(shift.startsAt)}–{formatTime(shift.endsAt)}
        </p>
        <Badge variant="outline" className={cn("mt-1 rounded-md", status.className)}>
          {status.label}
        </Badge>
      </div>
      <div className="min-w-0">
        <p className="font-medium">{shift.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{worksite?.name ?? "Archived worksite"}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {shift.requiredSkills.length > 0 ? (
            shift.requiredSkills.map((skill) => (
              <Badge key={skill} variant="secondary" className="rounded-md font-normal">
                {skill}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No special skills</span>
          )}
        </div>
      </div>
      <div>
        <Label className="mb-2 text-xs uppercase tracking-[0.12em] text-muted-foreground" htmlFor={`assign-${shift.id}`}>
          Assignee
        </Label>
        <select
          id={`assign-${shift.id}`}
          value={shift.employeeName ?? ""}
          onChange={(event) => assignShift(shift.id, event.target.value || undefined)}
          disabled={["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"].includes(shift.status)}
          className="flex h-8 w-full min-w-48 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-55"
        >
          <option value="">Unassigned</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.name}>
              {employee.name} · {employeeStatusLabels[employee.status]}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:justify-self-end">
        {!["COMPLETED", "CANCELLED"].includes(shift.status) ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={`Cancel ${shift.title}`}>
                <XCircle className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this shift?</AlertDialogTitle>
                <AlertDialogDescription>
                  Associated open incidents will also be closed. Historical records will be retained.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => cancelShift(shift.id)}>
                  Cancel shift
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <CheckCircle2 className="size-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

export function ShiftPlanner() {
  const { shifts } = useWiaControl();
  const firstDate = shifts[0]?.startsAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = React.useState(firstDate);
  const [view, setView] = React.useState<"day" | "week">("day");
  const [creating, setCreating] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("OPEN");
  const deferredQuery = React.useDeferredValue(query.trim().toLocaleLowerCase("en"));
  const periodEnd = view === "day" ? selectedDate : addDays(selectedDate, 6);

  const visibleShifts = React.useMemo(
    () =>
      [...shifts]
        .filter((shift) => {
          const date = shift.startsAt.slice(0, 10);
          const inPeriod = date >= selectedDate && date <= periodEnd;
          const inStatus =
            statusFilter === "ALL" ||
            (statusFilter === "OPEN"
              ? shift.status !== "CANCELLED"
              : shift.status === statusFilter);
          const inQuery = [shift.title, shift.employeeName, ...shift.requiredSkills]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("en")
            .includes(deferredQuery);
          return inPeriod && inStatus && inQuery;
        })
        .sort((first, second) => first.startsAt.localeCompare(second.startsAt)),
    [deferredQuery, periodEnd, selectedDate, shifts, statusFilter]
  );

  const groupedShifts = React.useMemo(() => {
    const grouped = new Map<string, PlannedShift[]>();
    for (const shift of visibleShifts) {
      const date = shift.startsAt.slice(0, 10);
      grouped.set(date, [...(grouped.get(date) ?? []), shift]);
    }
    return [...grouped.entries()];
  }, [visibleShifts]);

  const uncovered = shifts.filter((shift) => shift.status === "UNCOVERED").length;
  const active = shifts.filter((shift) => ["ACTIVE", "PAUSED"].includes(shift.status)).length;
  const assigned = shifts.filter((shift) => shift.employeeName && shift.status !== "CANCELLED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Operations planning</p>
          <h1 className="mt-1 text-3xl font-semibold">Shifts</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Assign employees with availability checks and detect gaps before they affect the customer.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New shift
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Shifts", value: shifts.length, icon: CalendarDays, tone: "text-primary" },
          { label: "Assigned", value: assigned, icon: UserRound, tone: "text-success" },
          { label: "In progress", value: active, icon: Clock3, tone: "text-info" },
          { label: "Uncovered", value: uncovered, icon: AlertTriangle, tone: uncovered ? "text-destructive" : "text-success" },
        ].map((metric) => (
          <Card key={metric.label} className="border-border/70 bg-card/85 shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{metric.value}</p>
              </div>
              <metric.icon className={cn("size-5", metric.tone)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-4 text-primary" />
              Work plan
            </CardTitle>
            <CardDescription>Daily or weekly view with direct assignment.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={view} onValueChange={(value) => setView(value as "day" | "week")}>
              <TabsList>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-auto"
              aria-label="Start date"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Filter by status"
            >
              <option value="OPEN">Operativos</option>
              <option value="ALL">All</option>
              <option value="UNCOVERED">Uncovered</option>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/55 px-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              placeholder="Search task, employee, or skill"
              aria-label="Search shifts"
            />
          </div>

          {groupedShifts.length > 0 ? (
            groupedShifts.map(([date, dayShifts]) => (
              <section key={date} className="space-y-3" aria-labelledby={`day-${date}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 id={`day-${date}`} className="text-sm font-semibold capitalize">
                    {formatDay(date)}
                  </h2>
                  <Badge variant="secondary" className="rounded-md">{dayShifts.length} shifts</Badge>
                </div>
                <div className="space-y-3">
                  {dayShifts.map((shift) => (
                    <ShiftRow key={shift.id} shift={shift} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <CalendarDays className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No shifts in this period</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust the filters or plan a new shift.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ShiftDialog open={creating} onOpenChange={setCreating} defaultDate={selectedDate} />
    </div>
  );
}
