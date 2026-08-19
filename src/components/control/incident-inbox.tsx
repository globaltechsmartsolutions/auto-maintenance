"use client";

import * as React from "react";
import {
    AlertTriangle,
    ArrowUpCircle,
    CheckCircle2,
    UserPlus,
    XCircle,
} from "lucide-react";
import { useWiaControl } from "@/components/control/wia-control-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

type IncidentListItem = {
    id: string;
    shiftId: string;
    shiftTitle?: string;
    type: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    dueAt?: string;
    detectedAt: string;
    title: string;
    detail?: string;
    resolutionNotes?: string;
    employeeId?: string;
    employeeName?: string;
    worksiteId: string;
    worksiteName?: string;
    ownerId?: string;
    ownerName?: string;
};

const statusLabels: Record<IncidentStatus, string> = {
    OPEN: "Open",
    ACKNOWLEDGED: "Under review",
    RESOLVED: "Resolved",
    DISMISSED: "Dismissed",
};

const statusStyles: Record<IncidentStatus, string> = {
    OPEN: "border-warning/30 text-warning",
    ACKNOWLEDGED: "border-primary/30 text-primary",
    RESOLVED: "border-success/30 text-success",
    DISMISSED: "border-muted-foreground/30 text-muted-foreground",
};

const severityLabels: Record<IncidentSeverity, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
};

const severityStyles: Record<IncidentSeverity, string> = {
    LOW: "border-muted-foreground/30 text-muted-foreground",
    MEDIUM: "border-warning/30 text-warning",
    HIGH: "border-destructive/30 text-destructive",
    CRITICAL: "border-destructive/50 bg-destructive/10 text-destructive",
};

function formatDateTime(value: string, timezone: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
    }).format(new Date(value));
}

type NoteAction = "RESOLVE" | "DISMISS" | "ESCALATE";

export function IncidentInbox() {
    const { companyTimezone, employees, worksites } = useWiaControl();

    const [incidents, setIncidents] = React.useState<IncidentListItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string>();

    const [dateFilter, setDateFilter] = React.useState("");
    const [worksiteFilter, setWorksiteFilter] = React.useState("");
    const [employeeFilter, setEmployeeFilter] = React.useState("");
    const [severityFilter, setSeverityFilter] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<IncidentStatus | "">("OPEN");
    const [ownerFilter, setOwnerFilter] = React.useState<"all" | "mine" | "unassigned">("all");

    const [noteDraft, setNoteDraft] = React.useState<{ incidentId: string; action: NoteAction } | null>(
        null
    );
    const [noteText, setNoteText] = React.useState("");
    const [actionError, setActionError] = React.useState<string>();

    const fetchIncidents = React.useCallback(async () => {
        setLoading(true);
        setLoadError(undefined);
        const params = new URLSearchParams();
        if (dateFilter) {
            params.set("dateFrom", dateFilter);
            const nextDay = new Date(`${dateFilter}T00:00:00.000Z`);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            params.set("dateTo", nextDay.toISOString().slice(0, 10));
        }
        if (worksiteFilter) params.set("worksiteId", worksiteFilter);
        if (employeeFilter) params.set("employeeId", employeeFilter);
        if (severityFilter) params.set("severity", severityFilter);
        if (statusFilter) params.set("status", statusFilter);
        if (ownerFilter === "mine") params.set("mine", "true");
        if (ownerFilter === "unassigned") params.set("ownerId", "UNASSIGNED");

        try {
            const response = await fetch(`/api/control/incidents?${params.toString()}`, {
                cache: "no-store",
            });
            const body = (await response.json()) as { incidents?: IncidentListItem[]; error?: string };
            if (!response.ok) throw new Error(body.error ?? "The incident inbox could not be loaded.");
            setIncidents(body.incidents ?? []);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : "The incident inbox could not be loaded.");
        } finally {
            setLoading(false);
        }
    }, [dateFilter, worksiteFilter, employeeFilter, severityFilter, statusFilter, ownerFilter]);

    React.useEffect(() => {
        void fetchIncidents();
    }, [fetchIncidents]);

    async function runAction(incidentId: string, body: Record<string, unknown>) {
        setActionError(undefined);
        try {
            const response = await fetch(`/api/control/incidents/${incidentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const payload = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(payload.error ?? "The action could not be completed.");
            await fetchIncidents();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "The action could not be completed.");
        }
    }

    function closeNoteDraft() {
        setNoteDraft(null);
        setNoteText("");
    }

    async function submitNoteDraft() {
        if (!noteDraft || noteText.trim().length < 5) return;
        if (noteDraft.action === "RESOLVE") {
            await runAction(noteDraft.incidentId, { status: "RESOLVED", resolutionNotes: noteText.trim() });
        } else if (noteDraft.action === "DISMISS") {
            await runAction(noteDraft.incidentId, { status: "DISMISSED", resolutionNotes: noteText.trim() });
        } else {
            await runAction(noteDraft.incidentId, { action: "ESCALATE", note: noteText.trim() });
        }
        closeNoteDraft();
    }

    return (
        <div className="space-y-4">
            <Card className="border-border/70 bg-card/85 shadow-sm">
                <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="space-y-1">
                        <Label htmlFor="incident-filter-date" className="text-xs">Date</Label>
                        <input
                            id="incident-filter-date"
                            type="date"
                            value={dateFilter}
                            onChange={(event) => setDateFilter(event.target.value)}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="incident-filter-worksite" className="text-xs">Worksite</Label>
                        <select
                            id="incident-filter-worksite"
                            value={worksiteFilter}
                            onChange={(event) => setWorksiteFilter(event.target.value)}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <option value="">All worksites</option>
                            {worksites.map((worksite) => (
                                <option key={worksite.id} value={worksite.id}>
                                    {worksite.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="incident-filter-employee" className="text-xs">Employee</Label>
                        <select
                            id="incident-filter-employee"
                            value={employeeFilter}
                            onChange={(event) => setEmployeeFilter(event.target.value)}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <option value="">All employees</option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="incident-filter-severity" className="text-xs">Severity</Label>
                        <select
                            id="incident-filter-severity"
                            value={severityFilter}
                            onChange={(event) => setSeverityFilter(event.target.value)}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <option value="">All severities</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="incident-filter-owner" className="text-xs">Owner</Label>
                        <select
                            id="incident-filter-owner"
                            value={ownerFilter}
                            onChange={(event) => setOwnerFilter(event.target.value as typeof ownerFilter)}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <option value="all">Any owner</option>
                            <option value="mine">Assigned to me</option>
                            <option value="unassigned">Unassigned</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="incident-filter-status" className="text-xs">Status</Label>
                        <select
                            id="incident-filter-status"
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as IncidentStatus | "")}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            <option value="OPEN">Open</option>
                            <option value="ACKNOWLEDGED">Under review</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="DISMISSED">Dismissed</option>
                            <option value="">All statuses</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {actionError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">
                    {actionError}
                </p>
            ) : null}

            {loading ? (
                <p className="text-sm text-muted-foreground">Loading incidents…</p>
            ) : loadError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">
                    {loadError}
                </p>
            ) : incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incidents match these filters.</p>
            ) : (
                <div className="grid gap-3">
                    {incidents.map((incident) => {
                        const isClosed = ["RESOLVED", "DISMISSED"].includes(incident.status);
                        const isDraftingThisIncident = noteDraft?.incidentId === incident.id;
                        return (
                            <Card key={incident.id} className="border-border/70 bg-card/85 shadow-sm">
                                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
                                    <span
                                        className={cn(
                                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                            incident.status === "RESOLVED"
                                                ? "bg-success/10 text-success"
                                                : incident.status === "DISMISSED"
                                                    ? "bg-muted text-muted-foreground"
                                                    : "bg-warning/10 text-warning"
                                        )}
                                    >
                                        {incident.status === "RESOLVED" ? (
                                            <CheckCircle2 className="size-4" />
                                        ) : incident.status === "DISMISSED" ? (
                                            <XCircle className="size-4" />
                                        ) : (
                                            <AlertTriangle className="size-4" />
                                        )}
                                    </span>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium">{incident.title}</p>
                                            <Badge variant="outline" className={statusStyles[incident.status]}>
                                                {statusLabels[incident.status]}
                                            </Badge>
                                            <Badge variant="outline" className={severityStyles[incident.severity]}>
                                                {severityLabels[incident.severity]}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">{incident.detail}</p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {incident.employeeName ?? "Unassigned shift"} · {incident.worksiteName} · Detected{" "}
                                            {formatDateTime(incident.detectedAt, companyTimezone)}
                                            {incident.dueAt ? ` · Due by ${formatDateTime(incident.dueAt, companyTimezone)}` : ""}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {incident.ownerName ? `Owner: ${incident.ownerName}` : "Owner: Unassigned"}
                                        </p>
                                        {incident.resolutionNotes ? (
                                            <p className="mt-2 rounded-md bg-muted/45 px-2.5 py-2 text-xs text-muted-foreground">
                                                Resolution: {incident.resolutionNotes}
                                            </p>
                                        ) : null}
                                        {isDraftingThisIncident ? (
                                            <div className="mt-3 space-y-2 rounded-lg bg-muted/45 p-3">
                                                <Label htmlFor={`incident-note-${incident.id}`}>
                                                    {noteDraft?.action === "ESCALATE"
                                                        ? "Reason for escalation"
                                                        : noteDraft?.action === "DISMISS"
                                                            ? "Reason for dismissal"
                                                            : "Resolution note"}
                                                </Label>
                                                <Textarea
                                                    id={`incident-note-${incident.id}`}
                                                    value={noteText}
                                                    onChange={(event) => setNoteText(event.target.value)}
                                                    placeholder="Explain what happened and what you did about it."
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button type="button" size="sm" variant="ghost" onClick={closeNoteDraft}>
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={noteText.trim().length < 5}
                                                        onClick={() => void submitNoteDraft()}
                                                    >
                                                        Confirm
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                    {!isClosed && !isDraftingThisIncident ? (
                                        <div className="flex shrink-0 flex-wrap gap-2">
                                            {incident.status === "OPEN" ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => void runAction(incident.id, { status: "ACKNOWLEDGED" })}
                                                >
                                                    Review
                                                </Button>
                                            ) : null}
                                            {!incident.ownerName ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => void runAction(incident.id, { action: "ASSIGN" })}
                                                >
                                                    <UserPlus className="size-4" />
                                                    Assign to me
                                                </Button>
                                            ) : null}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setNoteDraft({ incidentId: incident.id, action: "ESCALATE" })}
                                            >
                                                <ArrowUpCircle className="size-4" />
                                                Escalate
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setNoteDraft({ incidentId: incident.id, action: "DISMISS" })}
                                            >
                                                <XCircle className="size-4" />
                                                Dismiss
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => setNoteDraft({ incidentId: incident.id, action: "RESOLVE" })}
                                            >
                                                <CheckCircle2 className="size-4" />
                                                Resolve
                                            </Button>
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
