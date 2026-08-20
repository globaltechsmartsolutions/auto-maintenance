"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  History,
  MapPinCheck,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { IncidentInbox } from "@/components/control/incident-inbox";
import {
  useWiaControl,
  type ClockEventType,
} from "@/components/control/wia-control-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const eventLabels: Record<ClockEventType, string> = {
  CLOCK_IN: "Clock-in",
  BREAK_START: "Break started",
  BREAK_END: "Break ended",
  CLOCK_OUT: "Clock-out",
};

function formatDateTime(value: string, timezone: string = "Europe/Madrid") {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

export function TimeTrackingDashboard() {
  const {
    shifts,
    worksites,
    clockEvents,
    incidents,
    corrections,
    companyTimezone,
    exportClockReport,
    reviewTimeCorrection,
    runIncidentDetection,
  } = useWiaControl();

  const sortedEvents = React.useMemo(
    () => [...clockEvents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [clockEvents]
  );
  const verifiedEvents = clockEvents.filter((event) => event.locationVerified).length;
  const openIncidents = incidents.filter((incident) =>
    ["OPEN", "ACKNOWLEDGED"].includes(incident.status)
  ).length;
  const pendingCorrections = corrections.filter((correction) =>
    ["PENDING", "DISPUTED"].includes(correction.status)
  ).length;
  const plannedMinutes = shifts.reduce((total, shift) => {
    return total + (new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / 60_000;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Time records and compliance</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-normal">Time tracking</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Immutable events, identified breaks, and corrections with approval history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={runIncidentDetection}>
            <ScanSearch className="size-4" />
            Review shifts
          </Button>
          <Button asChild variant="outline">
            <Link href="/employee">
              <Smartphone className="size-4" />
              Employee view
            </Link>
          </Button>
          <Button type="button" onClick={exportClockReport}>
            <Download className="size-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Planned hours
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {(plannedMinutes / 60).toLocaleString("en-GB", { maximumFractionDigits: 1 })} h
                </p>
              </div>
              <Clock3 className="size-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Received Events
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{clockEvents.length}</p>
              </div>
              <History className="size-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Verified
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{verifiedEvents}</p>
                <p className="mt-1 text-xs text-muted-foreground">by worksite or location</p>
              </div>
              <MapPinCheck className="size-5 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/85 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Pendings
                </p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{openIncidents}</p>
                <p className="mt-1 text-xs text-muted-foreground">require review</p>
              </div>
              <AlertTriangle className="size-5 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/25 bg-primary/[0.045] shadow-sm">
        <CardContent className="grid gap-4 p-4 md:grid-cols-[auto_1fr] md:items-start">
          <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="font-medium">Traceability ready for workforce compliance</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The model retains clock-in, clock-out, breaks, method, worksite, and corrections without deleting the original record.
              Production applies four-year retention and role-based access.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Daily log",
                "Separate breaks",
                "Traceable corrections",
                "Immediate export",
              ].map((item) => (
                <Badge key={item} variant="outline" className="border-primary/25 bg-background/40">
                  <CheckCircle2 className="size-3 text-primary" />
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="events" className="gap-4">
        <TabsList className="h-9 w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents
            {openIncidents > 0 ? (
              <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                {openIncidents}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="corrections">
            Corrections
            {pendingCorrections > 0 ? (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {pendingCorrections}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck2 className="size-4 text-primary" />
                Event log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Date and time</TableHead>
                    <TableHead>Worksite</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEvents.map((event) => {
                    const site = worksites.find((item) => item.id === event.worksiteId);
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.employeeName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-md">
                            {eventLabels[event.type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatDateTime(event.occurredAt, companyTimezone)}</TableCell>
                        <TableCell>{site?.name ?? "Worksite"}</TableCell>
                        <TableCell>{event.method === "MOBILE" ? "Mobile" : event.method}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs",
                              event.locationVerified ? "text-success" : "text-muted-foreground"
                            )}
                          >
                            {event.locationVerified ? (
                              <MapPinCheck className="size-3.5" />
                            ) : (
                              <History className="size-3.5" />
                            )}
                            {event.correctionOf
                              ? "Correction tracked"
                              : event.locationVerified
                                ? "Verificado"
                                : "Revisado"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <IncidentInbox />
        </TabsContent>

        <TabsContent value="corrections">
          <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" />
                Correction history
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Original time</TableHead>
                    <TableHead>Corrected time</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corrections.map((correction) => (
                    <TableRow key={correction.id}>
                      <TableCell className="font-medium">{correction.employeeName}</TableCell>
                      <TableCell>{formatDateTime(correction.originalTime, companyTimezone)}</TableCell>
                      <TableCell>{formatDateTime(correction.correctedTime, companyTimezone)}</TableCell>
                      <TableCell>{correction.reason}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            correction.status === "APPROVED" && "border-success/30 bg-success/10 text-success",
                            correction.status === "REJECTED" && "border-destructive/30 bg-destructive/10 text-destructive",
                            correction.status === "PENDING" && "border-warning/30 bg-warning/10 text-warning",
                            correction.status === "DISPUTED" && "border-info/30 bg-info/10 text-info"
                          )}
                        >
                          {{
                            APPROVED: "Approved",
                            REJECTED: "Rejected",
                            PENDING: "Pending",
                            DISPUTED: "Disputed",
                          }[correction.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {["PENDING", "DISPUTED"].includes(correction.status) ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => reviewTimeCorrection(correction.id, "REJECTED")}
                            >
                              Reject
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => reviewTimeCorrection(correction.id, "APPROVED")}
                            >
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">Closed</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/45 p-3 text-xs text-muted-foreground">
                <UserRound className="mt-0.5 size-3.5 shrink-0" />
                The proposed time and decision remain linked to the clock event; the original record is not modified.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
