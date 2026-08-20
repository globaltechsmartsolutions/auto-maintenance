"use client";

import * as React from "react";
import { useDemo } from "@/components/demo/demo-provider";
import {
  computeIncidentSeverity,
  escalateSeverity,
  getShiftStatusAfterClock,
  rangesOverlap,
  type AttendanceIncidentDto,
  type ClockEventDto,
  type ClockEventType as DomainClockEventType,
  type CommunicationDto,
  type CoverageDecisionDto,
  type EmployeeOptionDto,
  type PlannedShiftDto,
  type ShiftStatus as DomainShiftStatus,
  type TimeCorrectionDto,
  type WorksiteDto,
} from "@/lib/wia-control/domain-core";
import {
  createQueuedCommand,
  isExpired,
  markNeedsAttention,
  markRetryableFailure,
  markSending,
  resetForManualRetry,
  sortQueueForSend,
  toRequestPayload,
  type QueuedClockCommand,
  type QueuedClockCommandStatus,
} from "@/lib/offline-clock-queue";
import {
  listQueuedCommands,
  putQueuedCommand,
  removeQueuedCommand,
} from "@/lib/offline-clock-queue-db";

const STORAGE_KEY = "wiacontrol-demo-state-v1";
const DEMO_DATE = "2026-08-08";

export type ShiftStatus = DomainShiftStatus;
export type ClockEventType = DomainClockEventType;
export type Worksite = WorksiteDto;
export type PlannedShift = PlannedShiftDto;
export type ClockEvent = ClockEventDto;
export type AttendanceIncident = AttendanceIncidentDto;
export type TimeCorrection = TimeCorrectionDto;
export type CoverageDecision = CoverageDecisionDto;
export type Communication = CommunicationDto;
export type EmployeeOption = EmployeeOptionDto;

type WiaControlState = {
  worksites: Worksite[];
  shifts: PlannedShift[];
  clockEvents: ClockEvent[];
  incidents: AttendanceIncident[];
  corrections: TimeCorrection[];
  coverageDecisions: CoverageDecision[];
  communications: Communication[];
  employees: EmployeeOption[];
  /** The company's configured display timezone (e.g. "Asia/Dubai"). */
  companyTimezone: string;
};

type WiaControlContextValue = WiaControlState & {
  acknowledgeTimeCorrection: (
    correctionId: string,
    accepted: boolean,
    disagreementReason?: string
  ) => void;
  addShift: (input: {
    worksiteId: string;
    title: string;
    employeeName?: string;
    startsAt: string;
    endsAt: string;
    requiredSkills: string[];
  }) => boolean;
  addWorksite: (input: Omit<Worksite, "id">) => void;
  archiveWorksite: (worksiteId: string) => boolean;
  assignShift: (shiftId: string, employeeName?: string) => boolean;
  assignReplacement: (
    shiftId: string,
    employeeName?: string,
    overrideReason?: string
  ) => boolean;
  cancelShift: (shiftId: string) => void;
  exportClockReport: () => void;
  recordClockEvent: (shiftId: string, type: ClockEventType) => void;
  recommendCoverage: (incidentId: string) => void;
  requestTimeCorrection: (clockEventId: string, correctedTime: string, reason: string) => boolean;
  resetControl: () => void;
  reviewTimeCorrection: (correctionId: string, status: "APPROVED" | "REJECTED") => void;
  runIncidentDetection: () => number;
  updateIncident: (
    incidentId: string,
    status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED",
    resolutionNotes?: string
  ) => void;
  /** Assigns an incident to the current coordinator ("assign to me"). */
  assignIncidentOwner: (incidentId: string) => void;
  /** Escalates an incident's severity one level, with a required note. */
  escalateIncident: (incidentId: string, note: string) => void;
  updateWorksite: (worksiteId: string, input: Omit<Worksite, "id">) => void;
  refreshControl: () => Promise<void>;
  /** Per-shift status of the offline clock queue, keyed by shiftId. */
  clockQueueStatus: Record<string, { status: QueuedClockCommandStatus; lastError?: string } | undefined>;
  /** Manually retry a shift's clock command that needs attention. */
  retryQueuedClockEvent: (shiftId: string) => void;
};

const worksites: Worksite[] = [
  {
    id: "site-atrium",
    name: "Atrium Labs · Serrano",
    customer: "Atrium Labs",
    address: "Calle Serrano 42",
    city: "Madrid",
    verificationMode: "QR + location",
    radiusMeters: 120,
  },
  {
    id: "site-torres",
    name: "Northern Towers · Entrances",
    customer: "Northern Towers Community",
    address: "14 Station Street",
    city: "Getafe",
    verificationMode: "QR + location",
    radiusMeters: 90,
  },
  {
    id: "site-alameda",
    name: "Alameda Clinic",
    customer: "Alameda Clinic",
    address: "Avinguda Diagonal 318",
    city: "Barcelona",
    verificationMode: "Worksite PIN",
    radiusMeters: 80,
  },
  {
    id: "site-bruma",
    name: "Hotel Bruma · Common areas",
    customer: "Hotel Bruma",
    address: "9 Seafront Avenue",
    city: "Alicante",
    verificationMode: "QR + location",
    radiusMeters: 140,
  },
];

function createInitialState(): WiaControlState {
  return {
    worksites,
    shifts: [
      {
        id: "shift-atrium-morning",
        worksiteId: "site-atrium",
        serviceId: "srv-1001",
        title: "Opening clean",
        employeeName: "Laura Méndez",
        startsAt: `${DEMO_DATE}T06:00:00+02:00`,
        endsAt: `${DEMO_DATE}T09:00:00+02:00`,
        status: "ACTIVE",
        requiredSkills: ["offices", "premium"],
      },
      {
        id: "shift-torres-morning",
        worksiteId: "site-torres",
        serviceId: "srv-1004",
        title: "Entrances and windows",
        originalEmployeeName: "Hugo Vega",
        startsAt: `${DEMO_DATE}T07:00:00+02:00`,
        endsAt: `${DEMO_DATE}T10:00:00+02:00`,
        status: "UNCOVERED",
        requiredSkills: ["communities", "windows"],
      },
      {
        id: "shift-alameda-morning",
        worksiteId: "site-alameda",
        serviceId: "srv-1002",
        title: "Clinic disinfection",
        employeeName: "Miguel Prieto",
        startsAt: `${DEMO_DATE}T07:00:00+02:00`,
        endsAt: `${DEMO_DATE}T09:30:00+02:00`,
        status: "ACTIVE",
        requiredSkills: ["healthcare", "disinfection"],
      },
      {
        id: "shift-bruma-morning",
        worksiteId: "site-bruma",
        serviceId: "srv-1003",
        title: "Common areas",
        employeeName: "Irene Costa",
        startsAt: `${DEMO_DATE}T08:00:00+02:00`,
        endsAt: `${DEMO_DATE}T11:00:00+02:00`,
        status: "PLANNED",
        requiredSkills: ["hotels", "common areas"],
      },
      {
        id: "shift-atrium-afternoon",
        worksiteId: "site-atrium",
        serviceId: "srv-1001",
        title: "Afternoon maintenance",
        employeeName: "Nadia Ramos",
        startsAt: `${DEMO_DATE}T14:00:00+02:00`,
        endsAt: `${DEMO_DATE}T17:00:00+02:00`,
        status: "PLANNED",
        requiredSkills: ["offices"],
      },
      {
        id: "shift-torres-afternoon",
        worksiteId: "site-torres",
        serviceId: "srv-1004",
        title: "Common-area touch-up",
        employeeName: "Laura Méndez",
        startsAt: `${DEMO_DATE}T16:00:00+02:00`,
        endsAt: `${DEMO_DATE}T18:00:00+02:00`,
        status: "PLANNED",
        requiredSkills: ["communities"],
      },
    ],
    clockEvents: [
      {
        id: "clock-laura-in",
        shiftId: "shift-atrium-morning",
        worksiteId: "site-atrium",
        employeeName: "Laura Méndez",
        type: "CLOCK_IN",
        occurredAt: `${DEMO_DATE}T06:02:00+02:00`,
        recordedAt: `${DEMO_DATE}T06:02:04+02:00`,
        method: "QR",
        locationVerified: true,
      },
      {
        id: "clock-miguel-in",
        shiftId: "shift-alameda-morning",
        worksiteId: "site-alameda",
        employeeName: "Miguel Prieto",
        type: "CLOCK_IN",
        occurredAt: `${DEMO_DATE}T07:11:00+02:00`,
        recordedAt: `${DEMO_DATE}T07:11:03+02:00`,
        method: "PIN",
        locationVerified: true,
      },
      {
        id: "clock-nadia-out-corrected",
        shiftId: "shift-atrium-afternoon",
        worksiteId: "site-atrium",
        employeeName: "Nadia Ramos",
        type: "CLOCK_OUT",
        occurredAt: "2026-08-07T17:06:00+02:00",
        recordedAt: "2026-08-07T18:22:00+02:00",
        method: "MANUAL",
        locationVerified: false,
        correctionOf: "clock-nadia-out-original",
      },
    ],
    incidents: [
      {
        id: "incident-torres-absence",
        shiftId: "shift-torres-morning",
        employeeName: "Hugo Vega",
        type: "MISSING_CLOCK_IN",
        title: "Uncovered service",
        detail: "Hugo is absent and there is no clock-in event for the 07:00 shift.",
        status: "OPEN",
        severity: "HIGH",
        detectedAt: `${DEMO_DATE}T07:05:00+02:00`,
        recommendedEmployee: "Nadia Ramos",
        recommendationReasons: [
          "Experience in residential communities and windows",
          "Getafe area included in the usual radius",
          "Availability matches the shift",
        ],
      },
      {
        id: "incident-alameda-late",
        shiftId: "shift-alameda-morning",
        employeeName: "Miguel Prieto",
        type: "LATE",
        title: "Clock-in 11 minutes late",
        detail: "The clock event is valid and verified; the delay still needs an explanation.",
        status: "ACKNOWLEDGED",
        severity: "LOW",
        detectedAt: `${DEMO_DATE}T07:11:03+02:00`,
      },
    ],
    corrections: [
      {
        id: "correction-nadia-out",
        clockEventId: "clock-nadia-out-original",
        employeeName: "Nadia Ramos",
        originalTime: "2026-08-07T17:42:00+02:00",
        correctedTime: "2026-08-07T17:06:00+02:00",
        reason: "Forgot to clock out after completing the service",
        status: "APPROVED",
        createdAt: "2026-08-07T18:22:00+02:00",
      },
      {
        id: "correction-miguel-in",
        clockEventId: "clock-miguel-in",
        employeeName: "Miguel Prieto",
        originalTime: `${DEMO_DATE}T07:11:00+02:00`,
        correctedTime: `${DEMO_DATE}T07:03:00+02:00`,
        reason: "The PIN did not respond on the first attempt and the coordinator was present.",
        status: "PENDING",
        createdAt: `${DEMO_DATE}T08:14:00+02:00`,
      },
    ],
    coverageDecisions: [],
    communications: [],
    employees: [],
    companyTimezone: "Europe/Madrid",
  };
}

function mergeSavedState(saved: Partial<WiaControlState>): WiaControlState {
  const initial = createInitialState();
  return {
    worksites: Array.isArray(saved.worksites) ? saved.worksites : initial.worksites,
    shifts: Array.isArray(saved.shifts) ? saved.shifts : initial.shifts,
    clockEvents: Array.isArray(saved.clockEvents) ? saved.clockEvents : initial.clockEvents,
    incidents: Array.isArray(saved.incidents) ? saved.incidents : initial.incidents,
    corrections: Array.isArray(saved.corrections) ? saved.corrections : initial.corrections,
    coverageDecisions: Array.isArray(saved.coverageDecisions)
      ? saved.coverageDecisions
      : initial.coverageDecisions,
    communications: Array.isArray(saved.communications)
      ? saved.communications
      : initial.communications,
    employees: initial.employees,
    companyTimezone:
      typeof saved.companyTimezone === "string" ? saved.companyTimezone : initial.companyTimezone,
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

const isBrowserDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function mapDemoEmployeeStatus(status: string): EmployeeOption["status"] {
  if (status === "Holiday") return "VACATION";
  if (status === "Sick leave") return "SICK_LEAVE";
  if (status === "Inactive") return "INACTIVE";
  if (status === "Assigned") return "ASSIGNED";
  return "AVAILABLE";
}

function worksiteVerificationCode(value: string) {
  if (value.includes("PIN")) return "PIN";
  if (value.includes("NFC")) return "NFC";
  if (value === "Worksite QR") return "QR";
  if (value === "Location only") return "LOCATION";
  return "QR_LOCATION";
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "The operation could not be completed.");
  }
  return body;
}

type LocationResult = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  /** Present only when location could not be captured; explains why. */
  unavailableReason?: "unsupported" | "permission_denied" | "position_unavailable" | "timeout";
};

function readCurrentLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ unavailableReason: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      (error) => {
        // GeolocationPositionError codes: 1 = PERMISSION_DENIED,
        // 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
        const reason =
          error.code === 1
            ? "permission_denied"
            : error.code === 3
              ? "timeout"
              : "position_unavailable";
        resolve({ unavailableReason: reason });
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 8_000 }
    );
  });
}

const locationUnavailableMessages: Record<
  NonNullable<LocationResult["unavailableReason"]>,
  string
> = {
  unsupported: "This device does not support location. Use the worksite's QR, PIN, or NFC method instead.",
  permission_denied:
    "Location permission was denied. Enable it in your browser settings, or use the worksite's QR, PIN, or NFC method.",
  position_unavailable:
    "Your location could not be determined. Try again outdoors, or use the worksite's QR, PIN, or NFC method.",
  timeout:
    "Finding your location took too long. Try again, or use the worksite's QR, PIN, or NFC method.",
};

const WiaControlContext = React.createContext<WiaControlContextValue | null>(null);

export function WiaControlProvider({ children }: { children: React.ReactNode }) {
  const { assignServiceTeam, employees: demoEmployees, notify } = useDemo();
  const [state, setState] = React.useState<WiaControlState>(() =>
    isBrowserDemo
      ? createInitialState()
      : {
        worksites: [],
        shifts: [],
        clockEvents: [],
        incidents: [],
        corrections: [],
        coverageDecisions: [],
        communications: [],
        employees: [],
        companyTimezone: "UTC",
      }
  );
  const [hydrated, setHydrated] = React.useState(false);
  const [loading, setLoading] = React.useState(!isBrowserDemo);
  const [loadError, setLoadError] = React.useState<string>();
  const [clockQueueStatus, setClockQueueStatus] = React.useState<
    Record<string, { status: QueuedClockCommandStatus; lastError?: string } | undefined>
  >({});
  const queueFlushInProgress = React.useRef(false);

  const setQueueStatus = React.useCallback(
    (shiftId: string, value: { status: QueuedClockCommandStatus; lastError?: string } | undefined) => {
      setClockQueueStatus((current) => ({ ...current, [shiftId]: value }));
    },
    []
  );
  const employeeOptions = React.useMemo<EmployeeOption[]>(
    () =>
      isBrowserDemo
        ? demoEmployees.map((employee) => ({
          id: employee.id,
          name: employee.name,
          status: mapDemoEmployeeStatus(employee.status),
          availability: employee.availability,
          skills: employee.skills ?? [],
          zones: employee.zones ?? [],
          performanceScore: employee.score,
        }))
        : state.employees,
    [demoEmployees, state.employees]
  );

  const refreshControl = React.useCallback(async () => {
    if (isBrowserDemo) return;
    setLoading(true);
    setLoadError(undefined);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const [dayResponse, worksitesResponse, employeesResponse, correctionsResponse, communicationsResponse] =
        await Promise.all([
          fetch(`/api/control/day?date=${date}`, { cache: "no-store" }),
          fetch("/api/control/worksites", { cache: "no-store" }),
          fetch("/api/control/employees", { cache: "no-store" }),
          fetch("/api/control/corrections", { cache: "no-store" }),
          fetch("/api/control/communications", { cache: "no-store" }),
        ]);
      const day = await readJson<{
        shifts: Array<{
          id: string;
          title: string;
          status: ShiftStatus;
          startsAt: string;
          endsAt: string;
          requiredSkills: string[];
          employee: { id: string; name: string } | null;
          worksite: { id: string };
          clockEvents: Array<{
            id: string;
            type: ClockEventType;
            method: ClockEvent["method"];
            occurredAt: string;
            recordedAt: string;
            locationVerified: boolean;
          }>;
          incidents: Array<{
            id: string;
            type: AttendanceIncident["type"];
            status: AttendanceIncident["status"];
            severity: AttendanceIncident["severity"];
            dueAt?: string;
            ownerId?: string;
            ownerName?: string;
            title: string;
            detail?: string;
            detectedAt: string;
            recommendedEmployee?: string;
          }>;
        }>;
        companyTimezone: string;
      }>(dayResponse);
      const worksitesData = await readJson<{
        worksites: Array<{
          id: string;
          name: string;
          address: string;
          city: string;
          verificationMode: string;
          radiusMeters: number;
          isActive: boolean;
          customer?: { name: string } | null;
        }>;
      }>(worksitesResponse);
      const employeesData = await readJson<{
        employees: Array<{
          id: string;
          fieldStatus: EmployeeOption["status"];
          availability?: unknown;
          skills: string[];
          zones: string[];
          performanceScore: number;
          user: { firstName: string; lastName: string };
        }>;
      }>(employeesResponse);
      const correctionsData = await readJson<{
        corrections: Array<{
          id: string;
          clockEventId: string;
          proposedOccurredAt: string;
          reason: string;
          status: TimeCorrection["status"];
          disagreementReason?: string;
          employeeAcknowledgedAt?: string;
          createdAt: string;
          employee: { user: { firstName: string; lastName: string } };
          clockEvent: { occurredAt: string };
        }>;
      }>(correctionsResponse);
      const communicationsData = await readJson<{
        communications: Array<{
          id: string;
          shiftId?: string;
          channel: Communication["channel"];
          template: string;
          status: Communication["status"];
          createdAt: string;
          recipientEmployee?: { user: { firstName: string; lastName: string } } | null;
        }>;
      }>(communicationsResponse);

      const mappedShifts: PlannedShift[] = day.shifts.map((shift) => ({
        id: shift.id,
        worksiteId: shift.worksite.id,
        title: shift.title,
        employeeName: shift.employee?.name,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        status: shift.status,
        requiredSkills: shift.requiredSkills,
      }));
      setState({
        worksites: worksitesData.worksites.map((worksite) => ({
          id: worksite.id,
          name: worksite.name,
          customer: worksite.customer?.name ?? "No linked customer",
          address: worksite.address,
          city: worksite.city,
          verificationMode: worksite.verificationMode,
          radiusMeters: Number(worksite.radiusMeters),
          isActive: worksite.isActive,
        })),
        shifts: mappedShifts,
        clockEvents: day.shifts.flatMap((shift) =>
          shift.clockEvents.map((event) => ({
            ...event,
            shiftId: shift.id,
            worksiteId: shift.worksite.id,
            employeeName: shift.employee?.name ?? "Employee",
          }))
        ),
        incidents: day.shifts.flatMap((shift) =>
          shift.incidents.map((incident) => ({
            ...incident,
            detail: incident.detail ?? "Incident awaiting review.",
            shiftId: shift.id,
            employeeName: shift.employee?.name,
            recommendationReasons: incident.recommendedEmployee
              ? [
                "Available with no overlaps",
                "Best fit by area and skills",
                "Recommendation recorded by WIA",
              ]
              : undefined,
          }))
        ),
        corrections: correctionsData.corrections.map((correction) => ({
          id: correction.id,
          clockEventId: correction.clockEventId,
          employeeName: `${correction.employee.user.firstName} ${correction.employee.user.lastName}`.trim(),
          originalTime: correction.clockEvent.occurredAt,
          correctedTime: correction.proposedOccurredAt,
          reason: correction.reason,
          status: correction.status,
          createdAt: correction.createdAt,
          disagreementReason: correction.disagreementReason,
          employeeAcknowledgedAt: correction.employeeAcknowledgedAt,
        })),
        coverageDecisions: [],
        companyTimezone: day.companyTimezone,
        communications: communicationsData.communications.map((communication) => ({
          id: communication.id,
          shiftId: communication.shiftId,
          recipientEmployee: communication.recipientEmployee
            ? `${communication.recipientEmployee.user.firstName} ${communication.recipientEmployee.user.lastName}`.trim()
            : "Recipient pending",
          channel: communication.channel,
          template: communication.template,
          status: communication.status,
          createdAt: communication.createdAt,
        })),
        employees: employeesData.employees.map((employee) => ({
          id: employee.id,
          name: `${employee.user.firstName} ${employee.user.lastName}`.trim(),
          status: employee.fieldStatus,
          availability:
            typeof employee.availability === "string"
              ? employee.availability
              : "Check availability",
          skills: employee.skills,
          zones: employee.zones,
          performanceScore: employee.performanceScore,
        })),
      });
      setHydrated(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "WIA Control could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isBrowserDemo) {
      void refreshControl();
      return;
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(mergeSavedState(JSON.parse(saved) as Partial<WiaControlState>));
      }
    } catch {
      setState(createInitialState());
    } finally {
      setHydrated(true);
    }
  }, [refreshControl]);

  const runRemoteMutation = React.useCallback(
    async (url: string, init: RequestInit) => {
      try {
        await readJson(await fetch(url, init));
        await refreshControl();
        return true;
      } catch (error) {
        notify(
          "The operation could not be completed",
          error instanceof Error ? error.message : "Vuelve a intentarlo."
        );
        return false;
      }
    },
    [notify, refreshControl]
  );

  const addWorksite = React.useCallback(
    (input: Omit<Worksite, "id">) => {
      if (!isBrowserDemo) {
        void runRemoteMutation("/api/control/worksites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            address: input.address,
            city: input.city,
            radiusMeters: input.radiusMeters,
            timezone: "Europe/Madrid",
            verificationMode: worksiteVerificationCode(input.verificationMode),
          }),
        });
        return;
      }
      const worksite = { ...input, id: createId("site") };
      setState((current) => ({
        ...current,
        worksites: [...current.worksites, worksite],
      }));
      notify("Worksite created", `${input.name} is now available for shift planning.`);
    },
    [notify, runRemoteMutation]
  );

  const acknowledgeTimeCorrection = React.useCallback(
    (correctionId: string, accepted: boolean, disagreementReason?: string) => {
      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/corrections/${correctionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ACKNOWLEDGE",
            accepted,
            disagreementReason,
          }),
        });
        return;
      }
      setState((current) => ({
        ...current,
        corrections: current.corrections.map((correction) =>
          correction.id === correctionId
            ? accepted
              ? { ...correction, employeeAcknowledgedAt: new Date().toISOString() }
              : {
                ...correction,
                status: "DISPUTED" as const,
                disagreementReason,
              }
            : correction
        ),
      }));
      notify(
        accepted ? "Decision confirmed" : "Disagreement recorded",
        accepted
          ? "The confirmation has been recorded."
          : "The coordinator must review the correction again."
      );
    },
    [notify, runRemoteMutation]
  );

  const addShift = React.useCallback(
    (input: {
      worksiteId: string;
      title: string;
      employeeName?: string;
      startsAt: string;
      endsAt: string;
      requiredSkills: string[];
    }) => {
      const employee = input.employeeName
        ? employeeOptions.find((item) => item.name === input.employeeName)
        : undefined;
      if (employee && ["VACATION", "SICK_LEAVE", "INACTIVE"].includes(employee.status)) {
        notify("Employee unavailable", `${employee.name} is not listed as available.`);
        return false;
      }

      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(input.endsAt);
      if (
        Number.isNaN(startsAt.getTime()) ||
        Number.isNaN(endsAt.getTime()) ||
        endsAt <= startsAt
      ) {
        notify("Invalid schedule", "The end time must be later than the start time.");
        return false;
      }
      const conflict = state.shifts.some(
        (shift) =>
          input.employeeName &&
          shift.employeeName === input.employeeName &&
          !["CANCELLED", "COMPLETED"].includes(shift.status) &&
          rangesOverlap(startsAt, endsAt, new Date(shift.startsAt), new Date(shift.endsAt))
      );
      if (conflict) {
        notify("Overlap detected", `${input.employeeName} already has a shift in that interval.`);
        return false;
      }

      if (!isBrowserDemo) {
        void runRemoteMutation("/api/control/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            worksiteId: input.worksiteId,
            employeeId: employee?.id,
            title: input.title,
            scheduledStart: input.startsAt,
            scheduledEnd: input.endsAt,
            requiredSkills: input.requiredSkills,
            gracePeriodMinutes: 5,
          }),
        });
        return true;
      }

      const shiftId = createId("shift");
      const shift: PlannedShift = {
        id: shiftId,
        worksiteId: input.worksiteId,
        title: input.title,
        employeeName: input.employeeName,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: input.employeeName ? "PLANNED" : "UNCOVERED",
        requiredSkills: input.requiredSkills,
      };
      setState((current) => ({
        ...current,
        shifts: [...current.shifts, shift],
        incidents: input.employeeName
          ? current.incidents
          : [
            {
              id: createId("incident"),
              shiftId,
              type: "MISSING_CLOCK_IN" as const,
              title: "Uncovered shift",
              detail: "The shift was created without an assigned employee.",
              status: "OPEN" as const,
              severity: computeIncidentSeverity("MISSING_CLOCK_IN"),
              detectedAt: new Date().toISOString(),
            },
            ...current.incidents,
          ],
      }));
      notify(
        input.employeeName ? "Shift planned" : "Shift created as uncovered",
        input.employeeName
          ? `${input.employeeName} has been assigned.`
          : "WIA will prioritise it in the coverage centre."
      );
      return true;
    },
    [employeeOptions, notify, runRemoteMutation, state.shifts]
  );

  const updateWorksite = React.useCallback(
    (worksiteId: string, input: Omit<Worksite, "id">) => {
      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/worksites/${worksiteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: input.name,
            address: input.address,
            city: input.city,
            radiusMeters: input.radiusMeters,
            verificationMode: worksiteVerificationCode(input.verificationMode),
          }),
        });
        return;
      }
      setState((current) => ({
        ...current,
        worksites: current.worksites.map((worksite) =>
          worksite.id === worksiteId ? { ...input, id: worksiteId } : worksite
        ),
      }));
      notify("Worksite updated", `${input.name} retains its full operational history.`);
    },
    [notify, runRemoteMutation]
  );

  const archiveWorksite = React.useCallback(
    (worksiteId: string) => {
      const hasOpenShifts = state.shifts.some(
        (shift) =>
          shift.worksiteId === worksiteId &&
          !["CANCELLED", "COMPLETED"].includes(shift.status)
      );
      if (hasOpenShifts) {
        notify(
          "Worksite has open shifts",
          "Cancel or reassign its shifts before archiving it."
        );
        return false;
      }

      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/worksites/${worksiteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });
        return true;
      }

      setState((current) => ({
        ...current,
        worksites: current.worksites.map((worksite) =>
          worksite.id === worksiteId ? { ...worksite, isActive: false } : worksite
        ),
      }));
      notify("Worksite archived", "It remains available in history and no longer accepts new shifts.");
      return true;
    },
    [notify, runRemoteMutation, state.shifts]
  );

  const assignShift = React.useCallback(
    (shiftId: string, employeeName?: string) => {
      const shift = state.shifts.find((item) => item.id === shiftId);
      if (!shift) return false;

      const employee = employeeName
        ? employeeOptions.find((item) => item.name === employeeName)
        : undefined;
      if (employee && ["VACATION", "SICK_LEAVE", "INACTIVE"].includes(employee.status)) {
        notify("Employee unavailable", `${employee.name} is not listed as available.`);
        return false;
      }

      const conflict = state.shifts.some(
        (item) =>
          item.id !== shiftId &&
          employeeName &&
          item.employeeName === employeeName &&
          !["CANCELLED", "COMPLETED"].includes(item.status) &&
          rangesOverlap(
            new Date(shift.startsAt),
            new Date(shift.endsAt),
            new Date(item.startsAt),
            new Date(item.endsAt)
          )
      );
      if (conflict) {
        notify("Overlap detected", `${employeeName} already has a shift in that interval.`);
        return false;
      }

      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/shifts/${shiftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: employee?.id ?? null }),
        });
        return true;
      }

      const resolvedAt = new Date().toISOString();
      setState((current) => ({
        ...current,
        shifts: current.shifts.map((item) =>
          item.id === shiftId
            ? {
              ...item,
              employeeName,
              status: employeeName ? (item.status === "UNCOVERED" ? "COVERED" : "PLANNED") : "UNCOVERED",
            }
            : item
        ),
        incidents: current.incidents.map((incident) =>
          incident.shiftId === shiftId
            ? {
              ...incident,
              status: employeeName ? ("RESOLVED" as const) : ("OPEN" as const),
              resolvedAt: employeeName ? resolvedAt : undefined,
            }
            : incident
        ),
      }));
      notify(
        employeeName ? "Assignee updated" : "Shift marked as uncovered",
        employeeName ? `${employeeName} has been assigned.` : "The shift has entered the coverage queue."
      );
      return true;
    },
    [employeeOptions, notify, runRemoteMutation, state.shifts]
  );

  const cancelShift = React.useCallback(
    (shiftId: string) => {
      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/shifts/${shiftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        });
        return;
      }
      const cancelledAt = new Date().toISOString();
      setState((current) => ({
        ...current,
        shifts: current.shifts.map((shift) =>
          shift.id === shiftId ? { ...shift, status: "CANCELLED" as const } : shift
        ),
        incidents: current.incidents.map((incident) =>
          incident.shiftId === shiftId && incident.status !== "RESOLVED"
            ? { ...incident, status: "DISMISSED" as const, resolvedAt: cancelledAt }
            : incident
        ),
      }));
      notify("Shift cancelled", "The change is reflected in planning and coverage.");
    },
    [notify, runRemoteMutation]
  );

  React.useEffect(() => {
    if (!isBrowserDemo || !hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The demo keeps working in memory if the browser blocks storage.
    }
  }, [hydrated, state]);

  React.useEffect(() => {
    if (!isBrowserDemo) return;
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        setState(mergeSavedState(JSON.parse(event.newValue) as Partial<WiaControlState>));
      } catch {
        setState(createInitialState());
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const assignReplacement = React.useCallback(
    (shiftId: string, requestedEmployee?: string, overrideReason?: string) => {
      const shift = state.shifts.find((item) => item.id === shiftId);
      const incident = state.incidents.find((item) => item.shiftId === shiftId);
      const employeeName = requestedEmployee ?? incident?.recommendedEmployee;
      if (!shift || !incident || !employeeName) return false;
      const recommendedEmployee = incident.recommendedEmployee;
      const isOverride = Boolean(
        recommendedEmployee && employeeName !== recommendedEmployee
      );
      if (isOverride && (!overrideReason || overrideReason.trim().length < 5)) {
        notify(
          "Reason for change required",
          "Explain why you selected someone other than the recommended employee."
        );
        return false;
      }

      if (!isBrowserDemo) {
        const selected = employeeOptions.find((employee) => employee.name === employeeName);
        if (!selected) {
          notify("Employee unavailable", "The selected profile could not be found.");
          return false;
        }
        void runRemoteMutation("/api/control/coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shiftId,
            incidentId: incident.id,
            selectedEmployeeId: selected.id,
            overrideReason: overrideReason?.trim(),
          }),
        });
        return true;
      }

      const resolvedAt = new Date().toISOString();
      const decisionId = createId("coverage");
      setState((current) => ({
        ...current,
        shifts: current.shifts.map((item) =>
          item.id === shiftId
            ? { ...item, employeeName, status: "COVERED" as const }
            : item
        ),
        incidents: current.incidents.map((item) =>
          item.shiftId === shiftId
            ? { ...item, status: "RESOLVED" as const, resolvedAt }
            : item
        ),
        coverageDecisions: [
          {
            id: decisionId,
            shiftId,
            incidentId: incident.id,
            recommendedEmployee,
            selectedEmployee: employeeName,
            type: isOverride ? "MANUAL_OVERRIDE" as const : "RECOMMENDATION_ACCEPTED" as const,
            score: recommendedEmployee ? 94 : undefined,
            reasons: incident.recommendationReasons ?? [],
            overrideReason: overrideReason?.trim(),
            createdAt: resolvedAt,
          },
          ...current.coverageDecisions,
        ],
        communications: [
          {
            id: createId("communication"),
            shiftId,
            recipientEmployee: employeeName,
            channel: "IN_APP" as const,
            template: "coverage_confirmed",
            status: "PENDING" as const,
            createdAt: resolvedAt,
          },
          ...current.communications,
        ],
      }));

      if (shift.serviceId) {
        assignServiceTeam(shift.serviceId, employeeName);
      }
      notify(
        "Coverage confirmed",
        `${employeeName} has received the shift and the audit trail has been saved.`
      );
      return true;
    },
    [
      assignServiceTeam,
      employeeOptions,
      notify,
      runRemoteMutation,
      state.incidents,
      state.shifts,
    ]
  );

  /**
   * Attempts to send one queued command to the server. Network failures are
   * kept queued for retry with the same idempotency key; a server-side
   * validation rejection (4xx from the domain layer) is surfaced as
   * "needs attention" instead of retried, since retrying would not change
   * the outcome.
   */
  const sendQueuedCommand = React.useCallback(
    async (command: QueuedClockCommand) => {
      setQueueStatus(command.shiftId, { status: "sending" });
      try {
        const response = await fetch("/api/control/clock-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toRequestPayload(markSending(command))),
        });

        if (response.ok) {
          await removeQueuedCommand(command.id).catch(() => undefined);
          setQueueStatus(command.shiftId, undefined);
          await refreshControl();
          return;
        }

        const body = (await response.json().catch(() => ({}))) as { error?: string };
        const message =
          response.status === 401
            ? "Your session has expired. Sign in again, then use Retry to save this clock event — it has not been lost."
            : body.error ?? `Request failed (${response.status}).`;
        const rejected = markNeedsAttention(command, message);
        await putQueuedCommand(rejected).catch(() => undefined);
        setQueueStatus(command.shiftId, { status: "needs_attention", lastError: rejected.lastError });
        notify(
          "A clock event needs attention",
          rejected.lastError ?? "The server could not accept this event."
        );
      } catch (error) {
        const retried = markRetryableFailure(
          command,
          error instanceof Error ? error.message : "Network error"
        );
        await putQueuedCommand(retried).catch(() => undefined);
        setQueueStatus(command.shiftId, { status: retried.status, lastError: retried.lastError });
        if (retried.status === "needs_attention") {
          notify(
            "A clock event needs attention",
            "This event could not be sent after several attempts. Check your connection and retry."
          );
        }
      }
    },
    [notify, refreshControl, setQueueStatus]
  );

  /**
   * Sends every queued command still waiting, in FIFO order. Expired
   * commands are dropped and surfaced as needing a manual correction
   * instead of being fabricated as sent.
   */
  const flushQueue = React.useCallback(async () => {
    if (isBrowserDemo) return;
    if (queueFlushInProgress.current) return;
    queueFlushInProgress.current = true;
    let commands: QueuedClockCommand[];
    try {
      commands = await listQueuedCommands();
    } catch {
      queueFlushInProgress.current = false;
      return;
    }

    try {
      const now = new Date();
      for (const command of sortQueueForSend(commands)) {
        if (command.status === "needs_attention") {
          setQueueStatus(command.shiftId, { status: "needs_attention", lastError: command.lastError });
          continue;
        }
        if (isExpired(command, now)) {
          await removeQueuedCommand(command.id).catch(() => undefined);
          setQueueStatus(command.shiftId, {
            status: "needs_attention",
            lastError: "This clock event expired before it could be sent. Use a time correction instead.",
          });
          continue;
        }
        if (new Date(command.nextAttemptAt).getTime() > now.getTime()) continue;
        await sendQueuedCommand(command);
      }
    } finally {
      queueFlushInProgress.current = false;
    }
  }, [sendQueuedCommand, setQueueStatus]);

  React.useEffect(() => {
    if (isBrowserDemo) return;
    void flushQueue();
    const handleOnline = () => void flushQueue();
    window.addEventListener("online", handleOnline);
    const interval = window.setInterval(() => void flushQueue(), 20_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(interval);
    };
  }, [flushQueue]);

  const retryQueuedClockEvent = React.useCallback(
    (shiftId: string) => {
      void (async () => {
        const commands = await listQueuedCommands().catch(() => [] as QueuedClockCommand[]);
        const command = commands.find((item) => item.shiftId === shiftId);
        if (!command) return;
        const reset = resetForManualRetry(command);
        await putQueuedCommand(reset).catch(() => undefined);
        setQueueStatus(shiftId, { status: "pending" });
        await sendQueuedCommand(reset);
      })();
    },
    [sendQueuedCommand, setQueueStatus]
  );

  const recordClockEvent = React.useCallback(
    (shiftId: string, type: ClockEventType) => {
      const shift = state.shifts.find((item) => item.id === shiftId);
      if (!shift?.employeeName) return;

      if (!isBrowserDemo) {
        // The idempotency key is generated once, right here, and persisted
        // to IndexedDB before any network attempt. It is reused for every
        // retry of this exact action so the server's uniqueness constraint
        // can guarantee "exactly one event" even if the device goes
        // offline mid-tap or the person retries manually.
        const id = crypto.randomUUID();
        const occurredAt = new Date().toISOString();
        void (async () => {
          const location = await readCurrentLocation();
          if (location.unavailableReason) {
            notify("Location not captured", locationUnavailableMessages[location.unavailableReason]);
          }
          const command = createQueuedCommand({
            id,
            shiftId,
            type,
            occurredAt,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracyMeters: location.accuracyMeters,
            isOffline: typeof navigator !== "undefined" ? !navigator.onLine : false,
          });
          await putQueuedCommand(command).catch(() => undefined);
          setQueueStatus(shiftId, { status: "pending" });
          await sendQueuedCommand(command);
        })();
        return;
      }

      const occurredAt = new Date().toISOString();
      const event: ClockEvent = {
        id: createId("clock"),
        shiftId,
        worksiteId: shift.worksiteId,
        employeeName: shift.employeeName,
        type,
        occurredAt,
        recordedAt: occurredAt,
        method: "MOBILE",
        locationVerified: true,
      };

      const nextStatus = getShiftStatusAfterClock(type);

      setState((current) => ({
        ...current,
        clockEvents: [event, ...current.clockEvents],
        shifts: current.shifts.map((item) =>
          item.id === shiftId ? { ...item, status: nextStatus } : item
        ),
        incidents: current.incidents.map((item) =>
          item.shiftId === shiftId && item.type === "MISSING_CLOCK_IN"
            ? { ...item, status: "RESOLVED" as const, resolvedAt: occurredAt }
            : item
        ),
      }));

      const labels: Record<ClockEventType, string> = {
        CLOCK_IN: "Clock-in recorded",
        BREAK_START: "Break started",
        BREAK_END: "Shift resumed",
        CLOCK_OUT: "Clock-out recorded",
      };
      notify(labels[type], "Worksite and time verified. The record cannot be overwritten.");
    },
    [notify, sendQueuedCommand, setQueueStatus, state.shifts]
  );

  const recommendCoverage = React.useCallback(
    (incidentId: string) => {
      if (isBrowserDemo) {
        notify("Recommendation ready", "WIA has prioritised compatible profiles.");
        return;
      }
      void runRemoteMutation("/api/control/coverage/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
    },
    [notify, runRemoteMutation]
  );

  const requestTimeCorrection = React.useCallback(
    (clockEventId: string, correctedTime: string, reason: string) => {
      const event = state.clockEvents.find((item) => item.id === clockEventId);
      const proposed = new Date(correctedTime);
      if (!event || Number.isNaN(proposed.getTime()) || reason.trim().length < 10) {
        notify(
          "Incomplete request",
          "Enter a valid time and a reason of at least 10 characters."
        );
        return false;
      }
      if (!isBrowserDemo) {
        void runRemoteMutation("/api/control/corrections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clockEventId,
            proposedOccurredAt: proposed.toISOString(),
            reason: reason.trim(),
          }),
        });
        return true;
      }
      setState((current) => ({
        ...current,
        corrections: [
          {
            id: createId("correction"),
            clockEventId,
            employeeName: event.employeeName,
            originalTime: event.occurredAt,
            correctedTime: proposed.toISOString(),
            reason: reason.trim(),
            status: "PENDING" as const,
            createdAt: new Date().toISOString(),
          },
          ...current.corrections,
        ],
      }));
      notify("Correction requested", "The original time is retained until a manager reviews it.");
      return true;
    },
    [notify, runRemoteMutation, state.clockEvents]
  );

  const reviewTimeCorrection = React.useCallback(
    (correctionId: string, status: "APPROVED" | "REJECTED") => {
      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/corrections/${correctionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REVIEW", status }),
        });
        return;
      }
      setState((current) => ({
        ...current,
        corrections: current.corrections.map((correction) =>
          correction.id === correctionId ? { ...correction, status } : correction
        ),
      }));
      notify(
        status === "APPROVED" ? "Correction approved" : "Correction rejected",
        "The decision remains linked to the original record in the history."
      );
    },
    [notify, runRemoteMutation]
  );

  const updateIncident = React.useCallback(
    (
      incidentId: string,
      status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED",
      resolutionNotes?: string
    ) => {
      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/incidents/${incidentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, resolutionNotes }),
        });
        return;
      }
      const resolvedAt = ["RESOLVED", "DISMISSED"].includes(status)
        ? new Date().toISOString()
        : undefined;
      setState((current) => ({
        ...current,
        incidents: current.incidents.map((incident) =>
          incident.id === incidentId
            ? { ...incident, status, resolvedAt, resolutionNotes }
            : incident
        ),
      }));
      notify(
        status === "ACKNOWLEDGED" ? "Incident under review" : "Incident closed",
        "The change and its resolution have been recorded."
      );
    },
    [notify, runRemoteMutation]
  );

  const assignIncidentOwner = React.useCallback(
    (incidentId: string) => {
      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/incidents/${incidentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ASSIGN" }),
        });
        return;
      }
      setState((current) => ({
        ...current,
        incidents: current.incidents.map((incident) =>
          incident.id === incidentId
            ? { ...incident, ownerId: "demo-user", ownerName: "You" }
            : incident
        ),
      }));
      notify("Incident assigned", "You are now the owner of this incident.");
    },
    [notify, runRemoteMutation]
  );

  const escalateIncident = React.useCallback(
    (incidentId: string, note: string) => {
      if (note.trim().length < 5) {
        notify("Reason required", "Explain why this incident needs escalation (at least 5 characters).");
        return;
      }
      if (!isBrowserDemo) {
        void runRemoteMutation(`/api/control/incidents/${incidentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ESCALATE", note: note.trim() }),
        });
        return;
      }
      setState((current) => ({
        ...current,
        incidents: current.incidents.map((incident) =>
          incident.id === incidentId
            ? { ...incident, severity: escalateSeverity(incident.severity) }
            : incident
        ),
      }));
      notify("Incident escalated", "Its severity has been raised for visibility.");
    },
    [notify, runRemoteMutation]
  );

  const runIncidentDetection = React.useCallback(() => {
    if (!isBrowserDemo) {
      void runRemoteMutation("/api/control/incidents/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ now: new Date().toISOString() }),
      });
      return 0;
    }
    const now = new Date();
    const newIncidents: AttendanceIncident[] = [];
    for (const shift of state.shifts) {
      if (
        new Date(shift.endsAt) >= now ||
        ["COMPLETED", "CANCELLED"].includes(shift.status)
      ) continue;
      const shiftEvents = state.clockEvents.filter((event) => event.shiftId === shift.id);
      const hasClockIn = shiftEvents.some((event) => event.type === "CLOCK_IN");
      const hasClockOut = shiftEvents.some((event) => event.type === "CLOCK_OUT");
      const type = hasClockIn && !hasClockOut
        ? "INCOMPLETE_CLOCK"
        : !hasClockIn
          ? "MISSING_CLOCK_IN"
          : null;
      if (
        !type ||
        state.incidents.some(
          (incident) => incident.shiftId === shift.id && incident.type === type
        )
      ) continue;
      newIncidents.push({
        id: createId("incident"),
        shiftId: shift.id,
        employeeName: shift.employeeName,
        type,
        title: type === "INCOMPLETE_CLOCK" ? "Shift missing clock-out" : "Shift missing clock-in",
        detail: "The shift has passed its end time and requires review.",
        status: "OPEN",
        severity: computeIncidentSeverity(type),
        detectedAt: now.toISOString(),
      });
    }
    if (newIncidents.length > 0) {
      setState((current) => ({
        ...current,
        incidents: [...newIncidents, ...current.incidents],
      }));
    }
    notify(
      newIncidents.length > 0 ? "Detection complete" : "No new incidents",
      newIncidents.length > 0
        ? `${newIncidents.length} shifts require review.`
        : "There are no new incomplete shifts."
    );
    return newIncidents.length;
  }, [notify, runRemoteMutation, state.clockEvents, state.incidents, state.shifts]);

  const exportClockReport = React.useCallback(() => {
    if (!isBrowserDemo) {
      void (async () => {
        try {
          const date = new Date().toISOString().slice(0, 10);
          const from = new Date(`${date}T00:00:00`).toISOString();
          const toDate = new Date(`${date}T00:00:00`);
          toDate.setDate(toDate.getDate() + 1);
          const response = await fetch(
            `/api/control/export/clocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(toDate.toISOString())}`,
            { cache: "no-store" }
          );
          if (!response.ok) {
            const error = await response.json() as { error?: string };
            throw new Error(error.error ?? "The report could not be generated.");
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `wia-control-time-tracking-${date}.csv`;
          anchor.click();
          URL.revokeObjectURL(url);
          notify("Report exported", "The export has been recorded in the audit log.");
        } catch (error) {
          notify(
            "Export failed",
            error instanceof Error ? error.message : "Vuelve a intentarlo."
          );
        }
      })();
      return;
    }
    const header = [
      "Employee",
      "Worksite",
      "Evento",
      "Date and time",
      "Method",
      "Location verified",
    ];
    const rows = state.clockEvents.map((event) => {
      const site = state.worksites.find((item) => item.id === event.worksiteId);
      return [
        event.employeeName,
        site?.name ?? event.worksiteId,
        event.type,
        event.occurredAt,
        event.method,
        event.locationVerified ? "Yes" : "No",
      ];
    });
    const content = [header, ...rows]
      .map((row) => row.map((cell) => csvCell(cell)).join(";"))
      .join("\n");
    const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `wia-control-time-tracking-${DEMO_DATE}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Report exported", "The CSV contains events, method, and location verification.");
  }, [notify, state.clockEvents, state.worksites]);

  const resetControl = React.useCallback(() => {
    if (!isBrowserDemo) {
      void refreshControl();
      return;
    }
    setState(createInitialState());
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory state has already been restored.
    }
    notify("WIAControl restored", "Shifts, clock events, and incidents have returned to their initial state.");
  }, [notify, refreshControl]);

  const value = React.useMemo<WiaControlContextValue>(
    () => ({
      ...state,
      employees: employeeOptions,
      acknowledgeTimeCorrection,
      addShift,
      addWorksite,
      archiveWorksite,
      assignIncidentOwner,
      assignShift,
      assignReplacement,
      cancelShift,
      clockQueueStatus,
      escalateIncident,
      exportClockReport,
      recordClockEvent,
      recommendCoverage,
      refreshControl,
      requestTimeCorrection,
      resetControl,
      retryQueuedClockEvent,
      reviewTimeCorrection,
      runIncidentDetection,
      updateIncident,
      updateWorksite,
    }),
    [
      acknowledgeTimeCorrection,
      addShift,
      addWorksite,
      archiveWorksite,
      assignIncidentOwner,
      assignShift,
      assignReplacement,
      cancelShift,
      clockQueueStatus,
      escalateIncident,
      exportClockReport,
      employeeOptions,
      recordClockEvent,
      recommendCoverage,
      refreshControl,
      requestTimeCorrection,
      resetControl,
      retryQueuedClockEvent,
      reviewTimeCorrection,
      runIncidentDetection,
      state,
      updateIncident,
      updateWorksite,
    ]
  );

  if (loading && !hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6" role="status">
        <div className="w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto size-9 animate-pulse rounded-lg bg-primary/15" />
          <p className="font-medium">Loading operations</p>
          <p className="text-sm text-muted-foreground">WIA is loading worksites, shifts, and clock events.</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6" role="alert">
        <div className="w-full max-w-md space-y-3 rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
          <p className="font-medium">WIA Control could not be loaded</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <button
            type="button"
            onClick={() => void refreshControl()}
            className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <WiaControlContext.Provider value={value}>{children}</WiaControlContext.Provider>;
}

export function useWiaControl() {
  const context = React.useContext(WiaControlContext);
  if (!context) {
    throw new Error("useWiaControl must be used within WiaControlProvider");
  }
  return context;
}
