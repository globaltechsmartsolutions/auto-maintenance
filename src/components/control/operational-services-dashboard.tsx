"use client";

import * as React from "react";
import { Building2, ClipboardCheck, Download, Eye, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Service = {
  id: string;
  title: string;
  serviceType: string;
  recurrence: string;
  status: "PENDING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduledStart?: string | null;
  customer: { id: string; name: string };
  plannedShifts: Array<{ id: string; status: string; worksite: { name: string }; incidents?: Array<{ status: string; severity: string }> }>;
};

type Customer = { id: string; name: string; city?: string | null };
type ServiceDetail = Omit<Service, "plannedShifts"> & {
  atRisk: boolean;
  plannedShifts: Array<Service["plannedShifts"][number] & {
    title: string;
    scheduledStart: string;
    scheduledEnd: string;
    employee: { user: { firstName: string; lastName: string } } | null;
    clockEvents: Array<unknown>;
    incidents: Array<{ status: string; severity: string }>;
    coverageDecisions: Array<unknown>;
    completion: { outcome: string; completedAt: string; note?: string | null } | null;
  }>;
};

const statusTone: Record<Service["status"], string> = {
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  SCHEDULED: "border-info/30 bg-info/10 text-info",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary",
  COMPLETED: "border-success/30 bg-success/10 text-success",
  CANCELLED: "border-border bg-muted text-muted-foreground",
};

function dateLabel(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Schedule not set";
}

export function OperationalServicesDashboard() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [open, setOpen] = React.useState(false);
  const [clientOpen, setClientOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savingClient, setSavingClient] = React.useState(false);
  const [detail, setDetail] = React.useState<ServiceDetail>();
  const [detailLoading, setDetailLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/control/services", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Services could not be loaded.");
      setServices(body.services ?? []);
      setCustomers(body.customers ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Services could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function createService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/control/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: String(data.get("customerId") ?? ""),
          title: String(data.get("title") ?? ""),
          serviceType: String(data.get("serviceType") ?? ""),
          recurrence: String(data.get("recurrence") ?? "ONE_TIME"),
          scheduledStart: data.get("scheduledStart")
            ? new Date(String(data.get("scheduledStart"))).toISOString()
            : undefined,
          scheduledEnd: data.get("scheduledEnd")
            ? new Date(String(data.get("scheduledEnd"))).toISOString()
            : undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "The service could not be created.");
      setOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The service could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function createClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSavingClient(true);
    setError(undefined);
    try {
      const response = await fetch("/api/control/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          type: String(data.get("type") ?? "BUSINESS"),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? ""),
          nif: String(data.get("nif") ?? ""),
          address: String(data.get("address") ?? ""),
          city: String(data.get("city") ?? ""),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "The client could not be recorded.");
      setClientOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The client could not be recorded.");
    } finally {
      setSavingClient(false);
    }
  }

  async function viewDetail(serviceId: string) {
    setDetailLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/control/services/${serviceId}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Service evidence could not be loaded.");
      setDetail(body.service);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Service evidence could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  }

  const isAtRisk = (service: Service) => service.plannedShifts.some((shift) =>
    shift.status === "UNCOVERED" || shift.incidents?.some((incident) =>
      ["OPEN", "ACKNOWLEDGED"].includes(incident.status) && ["HIGH", "CRITICAL"].includes(incident.severity)
    )
  );
  const servicesAtRisk = services.filter(isAtRisk).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Client commitments and operational coverage</p>
          <h1 className="mt-1 text-3xl font-semibold">Services</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Link every shift to the client service it fulfils, then identify coverage risk before it affects the customer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setClientOpen(true)}>
            <Plus className="size-4" /> New client
          </Button>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            disabled={customers.length === 0}
            title={customers.length === 0 ? "Record a client first: every service is delivered to one." : undefined}
          >
            <Plus className="size-4" /> Create service
          </Button>
        </div>
      </div>

      {!loading && customers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Record a client before creating a service.</p>
          <p className="mt-1">
            Every service is a commitment to somebody, so it cannot exist without them. Recording one
            needs nothing but a name — the rest can wait.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div><p className="font-medium">Action needed</p><p className="mt-1">{error}</p></div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Client services" value={services.length} icon={ClipboardCheck} />
        <Metric label="Services at risk" value={servicesAtRisk} icon={ShieldAlert} warning />
        <Metric label="Unlinked shifts" value="Review in shifts" icon={Building2} />
      </div>

      <Card className="border-border/70 bg-card/85 shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle className="text-base">Service register</CardTitle><CardDescription>Each service retains its client, schedule, and coverage evidence.</CardDescription></div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading services…</p> : services.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center"><ClipboardCheck className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium">No services yet</p><p className="mt-1 text-sm text-muted-foreground">Create a client service, then link its shifts in the planner.</p></div>
          ) : <div className="space-y-3">{services.map((service) => {
            const uncovered = service.plannedShifts.filter((shift) => shift.status === "UNCOVERED").length;
            const atRisk = isAtRisk(service);
            return <div key={service.id} className="grid gap-3 rounded-lg border border-border/70 bg-background/55 p-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
              <div><p className="font-medium">{service.title}</p><p className="mt-1 text-sm text-muted-foreground">{service.customer.name} · {service.serviceType} · {service.recurrence.toLowerCase()}</p><p className="mt-1 text-xs text-muted-foreground">{dateLabel(service.scheduledStart)}</p></div>
              <div className="flex flex-wrap gap-2"><Badge variant="outline" className={statusTone[service.status]}>{service.status.replaceAll("_", " ")}</Badge><Badge variant="secondary">{service.plannedShifts.length} linked shifts</Badge>{atRisk ? <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">{uncovered ? `${uncovered} uncovered` : "High-severity incident"}</Badge> : null}</div>
              <div className="flex items-center gap-2 md:justify-end"><p className="text-sm text-muted-foreground">{service.plannedShifts.map((shift) => shift.worksite.name).filter((value, index, all) => all.indexOf(value) === index).join(", ") || "No worksite linked"}</p><Button type="button" size="icon" variant="ghost" aria-label={`View ${service.title} evidence`} onClick={() => void viewDetail(service.id)}><Eye className="size-4" /></Button></div>
            </div>;
          })}</div>}
        </CardContent>
      </Card>

      <Dialog open={clientOpen} onOpenChange={setClientOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New client</DialogTitle><DialogDescription>The organisation the service is delivered to. Only the name is required.</DialogDescription></DialogHeader>
        <form id="client-form" className="grid gap-4 sm:grid-cols-2" onSubmit={createClient}>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="client-name">Client name</Label><Input id="client-name" name="name" minLength={2} maxLength={160} placeholder="Redwood Offices Ltd." required /></div>
          <div className="space-y-2"><Label htmlFor="client-type">Type</Label><select id="client-type" name="type" defaultValue="BUSINESS" className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="BUSINESS">Business</option><option value="COMMUNITY">Community of owners</option><option value="RESIDENTIAL">Residential</option><option value="INDUSTRIAL">Industrial</option></select></div>
          <div className="space-y-2"><Label htmlFor="client-nif">Tax number</Label><Input id="client-nif" name="nif" maxLength={20} placeholder="Optional" /></div>
          <div className="space-y-2"><Label htmlFor="client-email">Email</Label><Input id="client-email" name="email" type="email" maxLength={160} placeholder="Optional" /></div>
          <div className="space-y-2"><Label htmlFor="client-phone">Phone</Label><Input id="client-phone" name="phone" maxLength={40} placeholder="Optional" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="client-address">Address</Label><Input id="client-address" name="address" maxLength={240} placeholder="Optional" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="client-city">City</Label><Input id="client-city" name="city" maxLength={100} placeholder="Optional" /></div>
        </form>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setClientOpen(false)}>Cancel</Button><Button type="submit" form="client-form" disabled={savingClient}>{savingClient ? "Recording…" : "Record client"}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Create client service</DialogTitle><DialogDescription>Use a service for the contractual commitment; plan individual shifts afterwards.</DialogDescription></DialogHeader>
        <form id="service-form" className="grid gap-4 sm:grid-cols-2" onSubmit={createService}>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="service-customer">Customer</Label><select id="service-customer" name="customerId" required className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.city ? ` · ${customer.city}` : ""}</option>)}</select></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="service-title">Service name</Label><Input id="service-title" name="title" minLength={2} placeholder="Daily common-area cleaning" required /></div>
          <div className="space-y-2"><Label htmlFor="service-type">Service type</Label><Input id="service-type" name="serviceType" minLength={2} placeholder="Cleaning" required /></div>
          <div className="space-y-2"><Label htmlFor="service-recurrence">Recurrence</Label><select id="service-recurrence" name="recurrence" defaultValue="WEEKLY" className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"><option value="ONE_TIME">One time</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="BIWEEKLY">Every two weeks</option><option value="MONTHLY">Monthly</option><option value="CUSTOM">Custom</option></select></div>
          <div className="space-y-2"><Label htmlFor="service-start">First service start</Label><Input id="service-start" name="scheduledStart" type="datetime-local" /></div>
          <div className="space-y-2"><Label htmlFor="service-end">First service end</Label><Input id="service-end" name="scheduledEnd" type="datetime-local" /></div>
        </form>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="service-form" disabled={saving}>{saving ? "Creating…" : "Create service"}</Button></DialogFooter>
      </DialogContent></Dialog>

      <Dialog open={Boolean(detail) || detailLoading} onOpenChange={(next) => { if (!next) setDetail(undefined); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{detail?.title ?? "Loading service evidence…"}</DialogTitle><DialogDescription>{detail ? `${detail.customer.name} · ${detail.atRisk ? "Operational risk requires attention" : "No active high-severity coverage risk"}` : ""}</DialogDescription></DialogHeader>
        {detail ? <div className="space-y-3"><div className="flex justify-end"><a href={`/api/control/export/services/${detail.id}`}><Button type="button" variant="outline" size="sm"><Download className="size-4" /> Export evidence CSV</Button></a></div>{detail.plannedShifts.length ? detail.plannedShifts.map((shift) => <div key={shift.id} className="rounded-lg border border-border/70 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{shift.title}</p><Badge variant="secondary">{shift.status}</Badge></div><p className="mt-1 text-muted-foreground">{shift.worksite.name} · {dateLabel(shift.scheduledStart)} · {shift.employee ? `${shift.employee.user.firstName} ${shift.employee.user.lastName}` : "Unassigned"}</p><p className="mt-2 text-xs text-muted-foreground">{shift.clockEvents.length} clock events · {shift.incidents.filter((incident) => ["OPEN", "ACKNOWLEDGED"].includes(incident.status)).length} open incidents · {shift.coverageDecisions.length} coverage decisions</p>{shift.completion ? <p className="mt-2 rounded bg-muted px-2 py-1 text-xs">Completion: {shift.completion.outcome.replaceAll("_", " ")} · {dateLabel(shift.completion.completedAt)}{shift.completion.note ? ` · ${shift.completion.note}` : ""}</p> : <p className="mt-2 text-xs text-warning">No completion record yet.</p>}</div>) : <p className="py-8 text-center text-sm text-muted-foreground">No shifts are linked to this service.</p>}</div> : null}
      </DialogContent></Dialog>
    </div>
  );
}

function Metric({ label, value, icon: Icon, warning }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; warning?: boolean }) {
  return <Card className="border-border/70 bg-card/85 shadow-sm"><CardContent className="flex items-start justify-between gap-3 p-4"><div><p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div><Icon className={warning ? "size-5 text-destructive" : "size-5 text-primary"} /></CardContent></Card>;
}
