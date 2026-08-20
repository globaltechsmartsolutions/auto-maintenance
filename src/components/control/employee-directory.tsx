"use client";

import * as React from "react";
import { AlertTriangle, NotebookPen, Pencil, Plus, Trash2, UserRoundCheck } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatCurrency } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type FieldStatus = "AVAILABLE" | "ASSIGNED" | "VACATION" | "SICK_LEAVE" | "INACTIVE";

type Availability = {
    daysOfWeek?: number[];
    startMinute?: number;
    endMinute?: number;
} | null;

type EmployeeRecord = {
    id: string;
    name: string;
    email: string;
    position?: string;
    fieldStatus: FieldStatus;
    skills: string[];
    zones: string[];
    availability: Availability;
    maxHoursPerDay?: number;
    maxJobsPerDay?: number;
    performanceScore: number;
    internalNotes?: string;
    servicesCount: number;
    revenue: number;
};

const statusLabels: Record<FieldStatus, string> = {
    AVAILABLE: "Available",
    ASSIGNED: "Assigned",
    VACATION: "Holiday",
    SICK_LEAVE: "Sick leave",
    INACTIVE: "Inactive",
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutesToTime(minutes: number | undefined) {
    if (minutes === undefined) return "";
    const hours = Math.floor(minutes / 60)
        .toString()
        .padStart(2, "0");
    const mins = (minutes % 60).toString().padStart(2, "0");
    return `${hours}:${mins}`;
}
function timeToMinutes(value: string): number | undefined {
    if (!value) return undefined;
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;
    return hours * 60 + minutes;
}

function summarizeAvailability(availability: Availability) {
    if (!availability) return "No restriction set";
    const parts: string[] = [];
    if (availability.daysOfWeek && availability.daysOfWeek.length > 0) {
        parts.push(availability.daysOfWeek.map((day) => dayLabels[day]).join(", "));
    }
    if (availability.startMinute !== undefined && availability.endMinute !== undefined) {
        parts.push(`${minutesToTime(availability.startMinute)}–${minutesToTime(availability.endMinute)}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "No restriction set";
}

/**
 * Closes the Stage 4 follow-up gap: shows the company's real employees
 * (not fictional demo data) and lets an admin/manager configure the
 * exact fields the coverage-recommendation hard constraints depend on --
 * skills, zones, availability, and working-time limits.
 *
 * New employees receive a Supabase invitation, so the application never
 * exposes a reusable temporary password to a browser or administrator.
 */
export function EmployeeDirectory() {
    const [employees, setEmployees] = React.useState<EmployeeRecord[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [editing, setEditing] = React.useState<EmployeeRecord | null>(null);
    const [saveError, setSaveError] = React.useState<string>();
    const [saving, setSaving] = React.useState(false);
    const [creating, setCreating] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [createError, setCreateError] = React.useState<string>();
    const [deletingId, setDeletingId] = React.useState<string>();
    const [deleteError, setDeleteError] = React.useState<string>();

    const fetchEmployees = React.useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/control/employees", { cache: "no-store" });
            const body = (await response.json()) as { employees?: EmployeeRecord[] };
            setEmployees(body.employees ?? []);
        } catch {
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void fetchEmployees();
    }, [fetchEmployees]);

    const available = employees.filter((employee) => employee.fieldStatus === "AVAILABLE").length;
    const averagePerformance =
        employees.length > 0
            ? Math.round(employees.reduce((sum, employee) => sum + employee.performanceScore, 0) / employees.length)
            : 0;
    const missingProfile = employees.filter(
        (employee) => employee.skills.length === 0 && employee.zones.length === 0
    ).length;

    async function saveEmployee(update: {
        firstName: string;
        lastName: string;
        skills: string[];
        zones: string[];
        availability: Availability;
        maxHoursPerDay: number | null;
        maxJobsPerDay: number | null;
        fieldStatus: FieldStatus;
    }) {
        if (!editing) return;
        setSaving(true);
        setSaveError(undefined);
        try {
            const response = await fetch(`/api/control/employees/${editing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(update),
            });
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(body.error ?? "Could not save this profile.");
            await fetchEmployees();
            setEditing(null);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : "Could not save this profile.");
        } finally {
            setSaving(false);
        }
    }

    async function createEmployee(input: {
        firstName: string;
        lastName: string;
        email: string;
        position: string;
        skills: string[];
        zones: string[];
    }) {
        setCreating(true);
        setCreateError(undefined);
        try {
            const response = await fetch("/api/control/employees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(body.error ?? "Could not create this employee.");
            setCreateOpen(false);
            await fetchEmployees();
        } catch (error) {
            setCreateError(error instanceof Error ? error.message : "Could not create this employee.");
        } finally {
            setCreating(false);
        }
    }

    async function deleteEmployee(employeeId: string) {
        setDeletingId(employeeId);
        setDeleteError(undefined);
        try {
            const response = await fetch(`/api/control/employees/${employeeId}`, { method: "DELETE" });
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(body.error ?? "Could not remove this employee.");
            await fetchEmployees();
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : "Could not remove this employee.");
        } finally {
            setDeletingId(undefined);
        }
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-border/70 bg-card/85 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <UserRoundCheck className="size-4 text-primary" />
                            Available
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{available}</p>
                        <p className="text-sm text-muted-foreground">of {employees.length} employees</p>
                    </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/85 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base">Average performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{averagePerformance}/100</p>
                    </CardContent>
                </Card>
                <Card className="border-border/70 bg-card/85 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <NotebookPen className="size-4 text-primary" />
                            Needs a profile
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-semibold">{missingProfile}</p>
                        <p className="text-sm text-muted-foreground">no skills or zones set yet</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/70 bg-card/85 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Field team</CardTitle>
                    <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus className="size-3.5" />
                        New employee
                    </Button>
                </CardHeader>
                {deleteError ? (
                    <p className="mx-6 -mt-2 mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        {deleteError}
                    </p>
                ) : null}
                <CardContent>
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading employees…</p>
                    ) : employees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No employees yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Availability</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Services</TableHead>
                                        <TableHead>Performance</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map((employee) => (
                                        <TableRow key={employee.id}>
                                            <TableCell>
                                                <div className="font-medium">{employee.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {employee.position || employee.email}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {summarizeAvailability(employee.availability)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{statusLabels[employee.fieldStatus]}</Badge>
                                            </TableCell>
                                            <TableCell>{employee.servicesCount}</TableCell>
                                            <TableCell className="min-w-36">
                                                <div className="flex items-center gap-3">
                                                    <Progress value={employee.performanceScore} className="h-2" />
                                                    <span className="text-xs text-muted-foreground">
                                                        {employee.performanceScore}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(employee.revenue)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={`Edit employee ${employee.name}`}
                                                        title="Edit employee"
                                                        onClick={() => {
                                                            setSaveError(undefined);
                                                            setEditing(employee);
                                                        }}
                                                    >
                                                        <Pencil className="size-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                aria-label={`Remove employee ${employee.name}`}
                                                                title="Remove employee"
                                                                disabled={deletingId === employee.id}
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Remove {employee.name}?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    They will no longer be able to sign in or be assigned to a
                                                                    shift. Their past shifts, incidents, and records are kept.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => void deleteEmployee(employee.id)}>
                                                                    Remove
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                {editing ? (
                    <EmployeeEditDialog
                        employee={editing}
                        saving={saving}
                        error={saveError}
                        onSave={saveEmployee}
                    />
                ) : null}
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <NewEmployeeDialog saving={creating} error={createError} onSave={createEmployee} />
            </Dialog>

        </div>
    );
}
function EmployeeEditDialog({
    employee,
    saving,
    error,
    onSave,
}: {
    employee: EmployeeRecord;
    saving: boolean;
    error?: string;
    onSave: (update: {
        firstName: string;
        lastName: string;
        skills: string[];
        zones: string[];
        availability: Availability;
        maxHoursPerDay: number | null;
        maxJobsPerDay: number | null;
        fieldStatus: FieldStatus;
    }) => void;
}) {
    const [nameParts] = React.useState(() => {
        const parts = employee.name.split(/\s+/).filter(Boolean);
        return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
    });
    const [firstName, setFirstName] = React.useState(nameParts.firstName);
    const [lastName, setLastName] = React.useState(nameParts.lastName);
    const [skills, setSkills] = React.useState(employee.skills.join(", "));
    const [zones, setZones] = React.useState(employee.zones.join(", "));
    const [days, setDays] = React.useState<Set<number>>(new Set(employee.availability?.daysOfWeek ?? []));
    const [startTime, setStartTime] = React.useState(minutesToTime(employee.availability?.startMinute));
    const [endTime, setEndTime] = React.useState(minutesToTime(employee.availability?.endMinute));
    const [maxHours, setMaxHours] = React.useState(employee.maxHoursPerDay?.toString() ?? "");
    const [maxJobs, setMaxJobs] = React.useState(employee.maxJobsPerDay?.toString() ?? "");
    const [status, setStatus] = React.useState<FieldStatus>(employee.fieldStatus);

    function toggleDay(day: number) {
        setDays((current) => {
            const next = new Set(current);
            if (next.has(day)) next.delete(day);
            else next.add(day);
            return next;
        });
    }

    function handleSubmit() {
        const startMinute = timeToMinutes(startTime);
        const endMinute = timeToMinutes(endTime);
        const availability: Availability =
            days.size === 0 && startMinute === undefined && endMinute === undefined
                ? null
                : {
                    ...(days.size > 0 ? { daysOfWeek: Array.from(days).sort() } : {}),
                    ...(startMinute !== undefined ? { startMinute } : {}),
                    ...(endMinute !== undefined ? { endMinute } : {}),
                };

        onSave({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            skills: skills
                .split(",")
                .map((skill) => skill.trim())
                .filter(Boolean),
            zones: zones
                .split(",")
                .map((zone) => zone.trim())
                .filter(Boolean),
            availability,
            maxHoursPerDay: maxHours ? Number(maxHours) : null,
            maxJobsPerDay: maxJobs ? Number(maxJobs) : null,
            fieldStatus: status,
        });
    }

    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Edit {employee.name}</DialogTitle>
                <DialogDescription>
                    These fields determine who WIA can recommend for a shift, and what work they can
                    safely be assigned.
                </DialogDescription>
            </DialogHeader>

            {error ? (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {error}
                </p>
            ) : null}

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="employee-first-name">First name</Label>
                        <Input
                            id="employee-first-name"
                            value={firstName}
                            onChange={(event) => setFirstName(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="employee-last-name">Last name</Label>
                        <Input
                            id="employee-last-name"
                            value={lastName}
                            onChange={(event) => setLastName(event.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="employee-status">Status</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as FieldStatus)}>
                        <SelectTrigger id="employee-status" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(statusLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="employee-skills">Skills</Label>
                    <Input
                        id="employee-skills"
                        value={skills}
                        onChange={(event) => setSkills(event.target.value)}
                        placeholder="plumbing, windows, high-rise"
                    />
                    <p className="text-xs text-muted-foreground">Separate them with commas.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="employee-zones">Work zones</Label>
                    <Input
                        id="employee-zones"
                        value={zones}
                        onChange={(event) => setZones(event.target.value)}
                        placeholder="Enter location or work site"
                    />
                    <p className="text-xs text-muted-foreground">
                        Leave empty if this person can work anywhere.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>Available days</Label>
                    <div className="flex flex-wrap gap-3">
                        {dayLabels.map((label, day) => (
                            <label key={label} className="flex items-center gap-1.5 text-sm">
                                <Checkbox checked={days.has(day)} onCheckedChange={() => toggleDay(day)} />
                                {label}
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Leave all unchecked for every day.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="employee-start-time">Available from</Label>
                        <Input
                            id="employee-start-time"
                            type="time"
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="employee-end-time">Available until</Label>
                        <Input
                            id="employee-end-time"
                            type="time"
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="employee-max-hours">Max hours / day</Label>
                        <Input
                            id="employee-max-hours"
                            type="number"
                            min={1}
                            max={24}
                            value={maxHours}
                            onChange={(event) => setMaxHours(event.target.value)}
                            placeholder="No limit"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="employee-max-jobs">Max jobs / day</Label>
                        <Input
                            id="employee-max-jobs"
                            type="number"
                            min={1}
                            max={50}
                            value={maxJobs}
                            onChange={(event) => setMaxJobs(event.target.value)}
                            placeholder="No limit"
                        />
                    </div>
                </div>
            </div>

            <DialogFooter>
                <Button type="button" onClick={handleSubmit} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}
function NewEmployeeDialog({
    saving,
    error,
    onSave,
}: {
    saving: boolean;
    error?: string;
    onSave: (input: {
        firstName: string;
        lastName: string;
        email: string;
        position: string;
        skills: string[];
        zones: string[];
    }) => void;
}) {
    const [firstName, setFirstName] = React.useState("");
    const [lastName, setLastName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [position, setPosition] = React.useState("");
    const [skills, setSkills] = React.useState("");
    const [zones, setZones] = React.useState("");

    function handleSubmit() {
        onSave({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            position: position.trim(),
            skills: skills
                .split(",")
                .map((skill) => skill.trim())
                .filter(Boolean),
            zones: zones
                .split(",")
                .map((zone) => zone.trim())
                .filter(Boolean),
        });
    }

    const canSubmit =
        firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0;

    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>New employee</DialogTitle>
                <DialogDescription>
                    Sends this person a secure invitation to set their own password, then adds them to
                    your field team.
                </DialogDescription>
            </DialogHeader>

            {error ? (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    {error}
                </p>
            ) : null}

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-employee-first-name">First name</Label>
                        <Input
                            id="new-employee-first-name"
                            value={firstName}
                            onChange={(event) => setFirstName(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-employee-last-name">Last name</Label>
                        <Input
                            id="new-employee-last-name"
                            value={lastName}
                            onChange={(event) => setLastName(event.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-employee-email">Email</Label>
                    <Input
                        id="new-employee-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-employee-position">Position (optional)</Label>
                    <Input
                        id="new-employee-position"
                        value={position}
                        onChange={(event) => setPosition(event.target.value)}
                        placeholder="Senior operator"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-employee-skills">Skills (optional)</Label>
                    <Input
                        id="new-employee-skills"
                        value={skills}
                        onChange={(event) => setSkills(event.target.value)}
                        placeholder="plumbing, windows"
                    />
                    <p className="text-xs text-muted-foreground">Separate them with commas.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="new-employee-zones">Work zones (optional)</Label>
                    <Input
                        id="new-employee-zones"
                        value={zones}
                        onChange={(event) => setZones(event.target.value)}
                        placeholder="Enter location or work site"
                    />
                </div>
            </div>

            <DialogFooter>
                <Button type="button" onClick={handleSubmit} disabled={saving || !canSubmit}>
                    {saving ? "Creating…" : "Create employee"}
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}
