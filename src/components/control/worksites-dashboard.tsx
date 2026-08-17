"use client";

import * as React from "react";
import {
  Archive,
  Building2,
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  useWiaControl,
  type Worksite,
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

const verificationModes = [
  "QR + location",
  "Worksite QR",
  "Worksite PIN",
  "NFC",
  "Location only",
] as const;

function WorksiteDialog({
  open,
  onOpenChange,
  worksite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksite?: Worksite;
}) {
  const { addWorksite, updateWorksite } = useWiaControl();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: Omit<Worksite, "id"> = {
      name: String(data.get("name") ?? "").trim(),
      customer: String(data.get("customer") ?? "").trim(),
      address: String(data.get("address") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      verificationMode: String(data.get("verificationMode") ?? "QR + location"),
      radiusMeters: Number(data.get("radiusMeters") ?? 100),
      isActive: worksite?.isActive ?? true,
    };

    if (worksite) updateWorksite(worksite.id, input);
    else addWorksite(input);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{worksite ? "Edit worksite" : "New worksite"}</DialogTitle>
          <DialogDescription>
            Configure the service location and how clock events will be verified.
          </DialogDescription>
        </DialogHeader>
        <form id="worksite-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="worksite-name">Worksite name</Label>
            <Input
              id="worksite-name"
              name="name"
              defaultValue={worksite?.name}
              placeholder="Agora Building · Offices"
              minLength={2}
              maxLength={140}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worksite-customer">Customer</Label>
            <Input
              id="worksite-customer"
              name="customer"
              defaultValue={worksite?.customer}
              placeholder="Agora Services Ltd"
              minLength={2}
              maxLength={140}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="worksite-address">Address</Label>
            <Input
              id="worksite-address"
              name="address"
              defaultValue={worksite?.address}
              placeholder="125 Alcala Street"
              minLength={4}
              maxLength={240}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worksite-city">City</Label>
            <Input
              id="worksite-city"
              name="city"
              defaultValue={worksite?.city ?? "Madrid"}
              minLength={2}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worksite-verification">Verification</Label>
            <select
              id="worksite-verification"
              name="verificationMode"
              defaultValue={worksite?.verificationMode ?? verificationModes[0]}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {verificationModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="worksite-radius">Radio permitido (metros)</Label>
            <Input
              id="worksite-radius"
              name="radiusMeters"
              type="number"
              defaultValue={worksite?.radiusMeters ?? 100}
              min={20}
              max={2000}
              required
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="worksite-form">
            {worksite ? "Save changes" : "Create worksite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorksiteCard({ worksite }: { worksite: Worksite }) {
  const { archiveWorksite, shifts } = useWiaControl();
  const [editing, setEditing] = React.useState(false);
  const worksiteShifts = shifts.filter((shift) => shift.worksiteId === worksite.id);
  const openShifts = worksiteShifts.filter(
    (shift) => !["CANCELLED", "COMPLETED"].includes(shift.status)
  ).length;

  return (
    <>
      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
              <CheckCircle2 className="size-3" />
              Active
            </Badge>
          </div>
          <div className="pt-2">
            <CardTitle>{worksite.name}</CardTitle>
            <CardDescription className="mt-1">{worksite.customer}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>{worksite.address}, {worksite.city}</span>
            </p>
            <p className="flex items-center gap-2">
              <QrCode className="size-4 shrink-0" />
              {worksite.verificationMode} · {worksite.radiusMeters} m
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/45 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Total shifts</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{worksiteShifts.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open today</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{openShifts}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={`Archive ${worksite.name}`}>
                  <Archive className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive this worksite?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its history will be retained. You cannot archive it while it has open shifts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Back</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => archiveWorksite(worksite.id)}>
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
      <WorksiteDialog open={editing} onOpenChange={setEditing} worksite={worksite} />
    </>
  );
}

export function WorksitesDashboard() {
  const { worksites, shifts } = useWiaControl();
  const [creating, setCreating] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim().toLocaleLowerCase("en"));
  const activeWorksites = worksites.filter((worksite) => worksite.isActive !== false);
  const filteredWorksites = activeWorksites.filter((worksite) =>
    [worksite.name, worksite.customer, worksite.address, worksite.city]
      .join(" ")
      .toLocaleLowerCase("en")
      .includes(deferredQuery)
  );
  const cities = new Set(activeWorksites.map((worksite) => worksite.city)).size;
  const geofenced = activeWorksites.filter((worksite) =>
    worksite.verificationMode.toLocaleLowerCase("en").includes("location")
  ).length;
  const openShifts = shifts.filter((shift) => !["CANCELLED", "COMPLETED"].includes(shift.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Operational structure</p>
          <h1 className="mt-1 text-3xl font-semibold">Worksites</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Define where each service is delivered and what evidence is required with a clock event.
          </p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New worksite
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active worksites", value: activeWorksites.length, icon: Building2 },
          { label: "Cities", value: cities, icon: MapPin },
          { label: "Geofenced", value: geofenced, icon: ShieldCheck },
          { label: "Open shifts", value: openShifts, icon: CheckCircle2 },
        ].map((metric) => (
          <Card key={metric.label} className="border-border/70 bg-card/85 shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{metric.value}</p>
              </div>
              <metric.icon className="size-5 text-primary" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/75 px-3">
        <Search className="size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          placeholder="Search by worksite, customer, city, or address"
          aria-label="Search worksites"
        />
      </div>

      {filteredWorksites.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredWorksites.map((worksite) => (
            <WorksiteCard key={worksite.id} worksite={worksite} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-border bg-card/55 py-10 text-center">
          <CardContent>
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No matching worksites</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Change the search or create the first operational worksite.
            </p>
          </CardContent>
        </Card>
      )}

      <WorksiteDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
