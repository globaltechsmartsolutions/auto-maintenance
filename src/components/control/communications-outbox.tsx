"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock3, MailWarning, RefreshCw, Send } from "lucide-react";
import { useWiaControl } from "@/components/control/wia-control-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CommunicationStatus = "PENDING" | "PROCESSING" | "RETRYING" | "SENT" | "FAILED" | "CANCELLED";

type CommunicationItem = {
    id: string;
    shiftId?: string;
    shiftTitle?: string;
    recipientEmployeeId?: string;
    recipientEmployeeName?: string;
    channel: "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";
    template: string;
    status: CommunicationStatus;
    attempts: number;
    lastError?: string;
    sentAt?: string;
    acknowledgedAt?: string;
    nextAttemptAt: string;
    createdAt: string;
};

const statusLabels: Record<CommunicationStatus, string> = {
    PENDING: "Pending",
    PROCESSING: "Sending",
    RETRYING: "Retrying",
    SENT: "Sent",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
};

const statusStyles: Record<CommunicationStatus, string> = {
    PENDING: "border-muted-foreground/30 text-muted-foreground",
    PROCESSING: "border-primary/30 text-primary",
    RETRYING: "border-warning/30 text-warning",
    SENT: "border-success/30 text-success",
    FAILED: "border-destructive/30 text-destructive",
    CANCELLED: "border-muted-foreground/30 text-muted-foreground",
};

function formatDateTime(value: string | undefined, timezone: string) {
    if (!value) return undefined;
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
    }).format(new Date(value));
}

/**
 * Stage 5: shows every queued/attempted/delivered communication with its
 * real delivery status, attempt count, and last error — a coordinator can
 * see exactly what happened to a reassignment message, resend a failed
 * one, and the recipient can acknowledge it.
 */
export function CommunicationsOutbox() {
    const { communications: sharedCommunications, companyTimezone } = useWiaControl();
    const [items, setItems] = React.useState<CommunicationItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [actionError, setActionError] = React.useState<string>();
    const [actingOn, setActingOn] = React.useState<string>();
    const hasLoadedOnce = React.useRef(false);

    const fetchCommunications = React.useCallback(async () => {
        // Only show the loading state before the very first successful load —
        // a background refresh (periodic or triggered by an unrelated action
        // elsewhere) should never make the list flash back to "Loading…".
        if (!hasLoadedOnce.current) setLoading(true);
        try {
            const response = await fetch("/api/control/communications", { cache: "no-store" });
            const body = (await response.json()) as { communications?: CommunicationItem[] };
            const next = body.communications ?? [];
            // Only trigger a re-render when something actually changed -- a
            // background refresh that finds identical data should not touch
            // the UI at all, so nothing appears to "update" for no reason.
            setItems((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
        } catch {
            if (!hasLoadedOnce.current) setItems([]);
        } finally {
            hasLoadedOnce.current = true;
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void fetchCommunications();
        // Re-fetch whenever the shared communications count changes elsewhere
        // in the app (e.g. right after a coverage decision creates a new
        // one) -- this keeps the detailed status list current without
        // needing its own polling loop for that specific case.
    }, [fetchCommunications, sharedCommunications.length]);

    React.useEffect(() => {
        // A worker (cron job) changes delivery status server-side,
        // independent of any action taken in this browser tab -- a light
        // periodic refresh surfaces that within a reasonable delay, similar
        // to how the incident/offline-queue views stay current.
        const interval = window.setInterval(() => void fetchCommunications(), 20_000);
        return () => window.clearInterval(interval);
    }, [fetchCommunications]);

    async function runAction(id: string, action: "RESEND" | "ACKNOWLEDGE") {
        setActingOn(id);
        setActionError(undefined);
        try {
            const response = await fetch(`/api/control/communications/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const body = (await response.json().catch(() => ({}))) as { error?: string };
            if (!response.ok) throw new Error(body.error ?? "The action could not be completed.");
            await fetchCommunications();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "The action could not be completed.");
        } finally {
            setActingOn(undefined);
        }
    }

    return (
        <Card className="border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="size-4 text-primary" />
                    Communications
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {actionError ? (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">
                        {actionError}
                    </p>
                ) : null}
                {loading ? (
                    <p className="text-sm text-muted-foreground">Loading communications…</p>
                ) : items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No communications yet.</p>
                ) : (
                    <div className="grid gap-2">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/40 p-3 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="flex gap-2.5">
                                    <span
                                        className={cn(
                                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                                            item.status === "SENT"
                                                ? "bg-success/10 text-success"
                                                : item.status === "FAILED"
                                                    ? "bg-destructive/10 text-destructive"
                                                    : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {item.status === "SENT" ? (
                                            <CheckCircle2 className="size-3.5" />
                                        ) : item.status === "FAILED" ? (
                                            <MailWarning className="size-3.5" />
                                        ) : (
                                            <Clock3 className="size-3.5" />
                                        )}
                                    </span>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-medium">
                                                {item.template.replace(/_/g, " ")} · {item.channel}
                                            </p>
                                            <Badge variant="outline" className={statusStyles[item.status]}>
                                                {statusLabels[item.status]}
                                            </Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {item.recipientEmployeeName ?? "Recipient pending"}
                                            {item.shiftTitle ? ` · ${item.shiftTitle}` : ""} · Created{" "}
                                            {formatDateTime(item.createdAt, companyTimezone)}
                                            {item.sentAt ? ` · Sent ${formatDateTime(item.sentAt, companyTimezone)}` : ""}
                                            {item.acknowledgedAt
                                                ? ` · Acknowledged ${formatDateTime(item.acknowledgedAt, companyTimezone)}`
                                                : ""}
                                        </p>
                                        {item.status === "FAILED" && item.lastError ? (
                                            <p className="mt-1 flex items-start gap-1 text-xs text-destructive">
                                                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                                {item.attempts} attempts — {item.lastError}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    {item.status === "FAILED" ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={actingOn === item.id}
                                            onClick={() => void runAction(item.id, "RESEND")}
                                        >
                                            <RefreshCw className="size-3.5" />
                                            Resend
                                        </Button>
                                    ) : null}
                                    {item.status === "SENT" && !item.acknowledgedAt ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={actingOn === item.id}
                                            onClick={() => void runAction(item.id, "ACKNOWLEDGE")}
                                        >
                                            <CheckCircle2 className="size-3.5" />
                                            Acknowledge
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
