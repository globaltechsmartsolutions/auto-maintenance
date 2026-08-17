"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  automations,
  customers as mockCustomers,
  employees,
  invoices,
  leadPipeline,
  quotes,
  services,
} from "@/lib/mock-data";
import {
  getServiceProfile,
  recommendAssignee,
  type DemoAssignmentDecision,
  type DemoAssignmentRecommendation,
} from "@/lib/assignment/demo-assignment";

const STORAGE_KEY = "wia-control-demo-local-state-v2";

export type DemoLeadStatus = "New" | "Qualified" | "Quote" | "Won";
export type DemoDialogType =
  | "lead"
  | "service"
  | "employee"
  | "quote"
  | "invoice"
  | "note"
  | "request"
  | "automation"
  | "visit";
export type DemoAction =
  | "export-dashboard"
  | "filters"
  | "new-lead"
  | "new-service"
  | "new-employee"
  | "new-quote"
  | "new-invoice"
  | "download-document"
  | "billing-portal"
  | "new-automation"
  | "request-service"
  | "analytics"
  | "google-calendar"
  | "new-visit"
  | "settings"
  | "notifications"
  | "save-note";

export type DemoLead = {
  id: string;
  status: DemoLeadStatus;
  name: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  value: number;
  tags: string[];
  nextStep: string;
  createdAt: string;
};

export type DemoService = {
  id: string;
  title: string;
  customer: string;
  status: string;
  recurrence: string;
  start: string;
  team: string[];
  city: string;
  price: number;
  vatRate: number;
  address?: string;
  assignmentMode?: "Pending" | "Recommended" | "Manual" | "Auto-assigned";
  assignmentRecommendation?: DemoAssignmentRecommendation;
  description?: string;
  estimatedDurationMinutes?: number;
  requiredSkills?: string[];
};

export type DemoEmployee = {
  id: string;
  name: string;
  role: string;
  status: string;
  availability: string;
  jobs: number;
  score: number;
  revenue: number;
  notes: string;
  customerAffinity?: string[];
  incidentRate?: number;
  maxHoursPerDay?: number;
  maxJobsPerDay?: number;
  preferredServiceTypes?: string[];
  skills?: string[];
  zones?: string[];
};

export type DemoInvoice = {
  id: string;
  number: string;
  customer: string;
  status: string;
  dueDate: string;
  subtotal: number;
  vat: number;
  total: number;
};

export type DemoQuote = {
  id: string;
  number: string;
  customer: string;
  status: string;
  total: number;
  validUntil: string;
};

export type DemoAutomation = {
  id: string;
  name: string;
  trigger: string;
  channel: string;
  status: string;
  sent: number;
  conversion: string;
};

export type DemoNote = {
  id: string;
  customer: string;
  body: string;
  createdAt: string;
};

export type DemoCustomer = {
  id: string;
  name: string;
  type: string;
  contact: string;
  email: string;
  phone: string;
  status: string;
  tags: string[];
  lifetimeValue: number;
  nextService: string;
  address: string;
  risk: string;
  notes: string;
  serviceHistory: string[];
};

export type DemoPortalRequest = {
  id: string;
  customer: string;
  title: string;
  preferredDate: string;
  description: string;
  status: string;
  createdAt: string;
  assignedTeam?: string[];
  leadId?: string;
  serviceId?: string;
  scheduledAt?: string;
  suggestedTeam?: string[];
  assignmentMode?: "Pending" | "Recommended" | "Manual" | "Auto-assigned";
  assignmentRecommendation?: DemoAssignmentRecommendation;
};

export type DemoBookingInput = {
  customer: string;
  contactName: string;
  email: string;
  phone: string;
  title: string;
  city: string;
  address: string;
  preferredDate: string;
  preferredTime: string;
  description: string;
  estimatedPrice: number;
};

export type DemoActivity = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

type DemoState = {
  leads: DemoLead[];
  services: DemoService[];
  employees: DemoEmployee[];
  invoices: DemoInvoice[];
  quotes: DemoQuote[];
  automations: DemoAutomation[];
  notes: DemoNote[];
  portalRequests: DemoPortalRequest[];
  activities: DemoActivity[];
  assignmentDecisions: DemoAssignmentDecision[];
};

type DemoDialogState = {
  type: DemoDialogType;
  payload?: Record<string, string>;
};

type ToastMessage = {
  id: string;
  title: string;
  description?: string;
};

// Keep this contract stable: screens interact through this facade.
// In production, the local implementation is replaced by API/Supabase calls
// without rewriting the CRM pages.
export type DemoContextValue = DemoState & {
  customers: DemoCustomer[];
  addNote: (customer: string, body: string) => void;
  clearDemoScope: (scope: "web" | "services" | "leads" | "employees" | "notes") => void;
  convertQuoteToService: (quoteId: string) => void;
  createBookingRequest: (input: DemoBookingInput) => {
    assignedTeam: string[];
    leadId: string;
    requestId: string;
    scheduledAt: string;
    serviceId: string;
    suggestedTeam: string[];
  };
  assignServiceTeam: (serviceId: string, employeeName: string) => void;
  deleteEmployee: (employeeId: string) => void;
  deleteLead: (leadId: string) => void;
  deletePortalRequest: (requestId: string) => void;
  deleteService: (serviceId: string) => void;
  downloadDocument: (payload?: Record<string, string>) => void;
  getAssignmentRecommendation: (serviceId: string) => DemoAssignmentRecommendation | null;
  notify: (title: string, description?: string) => void;
  openDialog: (type: DemoDialogType, payload?: Record<string, string>) => void;
  rescheduleService: (serviceId: string, date: string) => void;
  resetDemo: () => void;
  runAction: (action: DemoAction, payload?: Record<string, string>) => void;
  toggleAutomation: (id: string, active: boolean) => void;
  updateEmployeeStatus: (id: string, status: string) => void;
  updateLeadStatus: (id: string, status: DemoLeadStatus) => void;
  updatePortalRequestStatus: (id: string, status: string) => void;
  updateServiceStatus: (id: string, status: string) => void;
};

const DemoContext = React.createContext<DemoContextValue | null>(null);

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function numberFrom(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textFrom(value: FormDataEntryValue | null, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function csvListFrom(value: string, fallback: string[] = []) {
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function payloadText(dialog: DemoDialogState, key: string, fallback = "") {
  return dialog.payload?.[key] ?? fallback;
}

function datePart(value?: string, fallback = addDays(1)) {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
}

function timePart(value?: string, fallback = "09:00") {
  const match = value?.match(/T(\d{2}:\d{2})/);
  if (match?.[1]) return match[1];

  return value && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : fallback;
}

function parseEuro(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const initialServiceIds = new Set(services.map((service) => service.id));
const initialInvoiceIds = new Set(invoices.map((invoice) => invoice.id));

type CustomerAccumulator = DemoCustomer & {
  dynamicValue: number;
  generated: boolean;
  hasLead: boolean;
  hasOpenService: boolean;
  hasOverdueInvoice: boolean;
  hasPendingWork: boolean;
  leadValue: number;
  nextDates: string[];
  serviceHistoryDraft: string[];
};

function normalizeCustomerKey(value: string) {
  return slugify(value || "customer");
}

function addUnique(values: string[], nextValue?: string) {
  const cleanValue = nextValue?.trim();
  if (cleanValue && !values.includes(cleanValue)) {
    values.push(cleanValue);
  }
}

function leadStatusFromOperationalStatus(status: string): DemoLeadStatus | null {
  if (status === "Completed") return "Won";
  if (status === "Scheduled" || status === "Autoasignado" || status === "In progress") {
    return "Qualified";
  }
  if (status === "Pending") return "New";
  return null;
}

function inferCustomerType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("hotel")) return "Hotel";
  if (normalized.includes("clinic")) return "Healthcare";
  if (normalized.includes("community") || normalized.includes("residential")) return "Community";
  if (normalized.includes("construction")) return "Post-construction";
  return "Customer";
}

function createGeneratedCustomer(name: string): CustomerAccumulator {
  const normalizedName = name.trim() || "Demo customer";

  return {
    id: `cust-${normalizeCustomerKey(normalizedName)}`,
    name: normalizedName,
    type: inferCustomerType(normalizedName),
    contact: "Primary contact",
    email: `contact@${normalizeCustomerKey(normalizedName)}.demo`,
    phone: "+34 600 000 000",
    status: "Follow-up",
    tags: ["Local demo"],
    lifetimeValue: 0,
    nextService: "",
    address: "Address pending",
    risk: "Low",
    notes: "Customer created automatically from the local demo.",
    serviceHistory: [],
    dynamicValue: 0,
    generated: true,
    hasLead: false,
    hasOpenService: false,
    hasOverdueInvoice: false,
    hasPendingWork: false,
    leadValue: 0,
    nextDates: [],
    serviceHistoryDraft: [],
  };
}

function buildDemoCustomers(state: DemoState): DemoCustomer[] {
  const customersByName = new Map<string, CustomerAccumulator>();

  mockCustomers.forEach((customer) => {
    customersByName.set(normalizeCustomerKey(customer.name), {
      ...customer,
      tags: [...customer.tags],
      serviceHistory: [...customer.serviceHistory],
      dynamicValue: 0,
      generated: false,
      hasLead: false,
      hasOpenService: false,
      hasOverdueInvoice: false,
      hasPendingWork: false,
      leadValue: 0,
      nextDates: [],
      serviceHistoryDraft: [],
    });
  });

  const ensureCustomer = (name: string) => {
    const key = normalizeCustomerKey(name);
    const current = customersByName.get(key);
    if (current) {
      return current;
    }

    const generated = createGeneratedCustomer(name);
    customersByName.set(key, generated);
    return generated;
  };

  state.leads.forEach((lead) => {
    const customer = ensureCustomer(lead.companyName);
    customer.hasLead = true;
    customer.contact = lead.contactName || customer.contact;
    customer.email = lead.email || customer.email;
    customer.phone = lead.phone || customer.phone;
    customer.leadValue += lead.value;
    lead.tags.forEach((tag) => addUnique(customer.tags, tag));
    addUnique(customer.tags, lead.status);
    if (customer.generated) {
      customer.notes = lead.nextStep;
    }
  });

  state.services.forEach((service) => {
    const customer = ensureCustomer(service.customer);
    const serviceTotal = service.price * (1 + service.vatRate / 100);
    const isInitialService = initialServiceIds.has(service.id);

    if (!isInitialService) {
      customer.dynamicValue += serviceTotal;
    }

    customer.hasOpenService ||= !["Cancelled", "Completed"].includes(service.status);
    customer.hasPendingWork ||= service.status === "Pending";
    customer.type =
      customer.type === "Customer" ? inferCustomerType(`${service.customer} ${service.title}`) : customer.type;
    customer.address = service.address ?? customer.address;
    customer.nextDates.push(service.start);
    customer.serviceHistoryDraft.push(`${service.title} - ${service.status.toLowerCase()}`);
    addUnique(customer.tags, service.city);
    addUnique(customer.tags, service.recurrence);
  });

  state.invoices.forEach((invoice) => {
    const customer = ensureCustomer(invoice.customer);
    if (!initialInvoiceIds.has(invoice.id)) {
      customer.dynamicValue += invoice.total;
    }
    customer.hasOverdueInvoice ||= invoice.status === "Overdue";
    customer.hasPendingWork ||= invoice.status === "Pending";
  });

  state.quotes.forEach((quote) => {
    const customer = ensureCustomer(quote.customer);
    addUnique(customer.tags, "Quote");
  });

  state.portalRequests.forEach((request) => {
    const customer = ensureCustomer(request.customer);
    customer.hasPendingWork ||= request.status === "Pending";
    customer.nextDates.push(request.scheduledAt ?? request.preferredDate);
    addUnique(customer.tags, "Web booking");
  });

  state.notes.forEach((note) => {
    ensureCustomer(note.customer);
  });

  return Array.from(customersByName.values()).map((customer) => {
    const nextDates = customer.nextDates
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second));
    const serviceHistory =
      customer.serviceHistoryDraft.length > 0
        ? customer.serviceHistoryDraft.slice(0, 6)
        : customer.serviceHistory;
    const generatedLeadValue =
      customer.generated && customer.dynamicValue === 0 ? customer.leadValue : 0;
    const lifetimeValue = Math.round(
      customer.lifetimeValue + customer.dynamicValue + generatedLeadValue
    );
    const status = customer.hasOverdueInvoice
      ? "Follow-up"
      : customer.hasOpenService
        ? "Active"
        : customer.hasLead
          ? "Follow-up"
          : customer.status;
    const risk = customer.hasOverdueInvoice
      ? "High"
      : customer.hasPendingWork
        ? "Medium"
        : customer.risk;

    return {
      id: customer.id,
      name: customer.name,
      type: customer.type,
      contact: customer.contact,
      email: customer.email,
      phone: customer.phone,
      status,
      tags: customer.tags,
      lifetimeValue,
      nextService: nextDates[0] ?? customer.nextService,
      address: customer.address,
      risk,
      notes: customer.notes,
      serviceHistory,
    };
  });
}

function createInitialState(): DemoState {
  const seededLeads = leadPipeline.flatMap((stage) => {
    const stageValue = parseEuro(stage.value);
    const leadValue = Math.round(stageValue / Math.max(stage.leads.length, 1));

    return stage.leads.map((lead, index) => ({
      id: `lead-${slugify(stage.status)}-${index}`,
      status: stage.status as DemoLeadStatus,
      name: lead,
      companyName: lead,
      contactName: index === 0 ? "Primary contact" : "Operations contact",
      email: `contact@${slugify(lead)}.demo`,
      phone: "+34 600 000 000",
      value: leadValue,
      tags: [stage.status, "Demo"],
      nextStep: "Sales follow-up",
      createdAt: new Date().toISOString(),
    }));
  });

  return {
    leads: seededLeads,
    services: services.map((service) => ({
      ...service,
      team: [...service.team],
    })),
    employees: employees.map((employee) => ({ ...employee })),
    invoices: invoices.map((invoice) => ({ ...invoice })),
    quotes: quotes.map((quote, index) => ({
      ...quote,
      id: `quote-${index}`,
    })),
    automations: automations.map((automation, index) => ({
      ...automation,
      id: `automation-${index}`,
    })),
    notes: [],
    portalRequests: [],
    assignmentDecisions: [
      {
        id: "decision-seed-windows-nadia",
        serviceId: "srv-1004",
        serviceTitle: "Windows and garage",
        serviceFamily: "Windows",
        customer: "Northern Towers Community",
        city: "Getafe",
        recommendedEmployee: "Nadia Ramos",
        selectedEmployee: "Nadia Ramos",
        wasAcceptedByManager: true,
        decisionType: "manager-confirmed",
        resultLabel: "Service completed without incidents.",
        createdAt: "2026-06-10T12:00:00",
        reasons: [
          "Window-cleaning specialist.",
          "Good fit for residential communities.",
          "Availability confirmed by the manager.",
        ],
      },
    ],
    activities: [
      {
        id: "activity-seed",
        title: "Local demo preparada",
        description: "Data is stored in this browser so the application can be demonstrated without a live backend.",
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function mergeSavedState(saved: Partial<DemoState>): DemoState {
  const initial = createInitialState();
  const savedEmployees = saved.employees ?? initial.employees;
  const savedEmployeeIds = new Set(savedEmployees.map((employee) => employee.id));

  return {
    ...initial,
    ...saved,
    services: saved.services ?? initial.services,
    employees: [
      ...savedEmployees,
      ...initial.employees.filter((employee) => !savedEmployeeIds.has(employee.id)),
    ],
    invoices: saved.invoices ?? initial.invoices,
    quotes: saved.quotes ?? initial.quotes,
    automations: saved.automations ?? initial.automations,
    leads: saved.leads ?? initial.leads,
    notes: saved.notes ?? initial.notes,
    portalRequests: saved.portalRequests ?? initial.portalRequests,
    activities: saved.activities ?? initial.activities,
    assignmentDecisions: saved.assignmentDecisions ?? initial.assignmentDecisions,
  };
}

function escapeCsv(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function safePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createSimplePdf(lines: string[]) {
  const textCommands = lines
    .slice(0, 32)
    .map((line, index) =>
      index === 0
        ? `(${safePdfText(line)}) Tj`
        : `0 -18 Td (${safePdfText(line)}) Tj`
    )
    .join("\n");
  const stream = `BT\n/F1 12 Tf\n50 790 Td\n${textCommands}\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DemoNativeSelect({
  className,
  defaultValue,
  name,
  options,
  ...props
}: {
  className?: string;
  defaultValue: string;
  name: string;
  options: string[];
} & Omit<React.ComponentProps<"select">, "children" | "defaultValue" | "name">) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      {...props}
      className={[
        "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function FormField({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const generatedId = React.useId();
  const inputId = React.isValidElement<{ id?: string }>(children)
    ? children.props.id ?? generatedId
    : generatedId;
  const control = React.isValidElement<{ id?: string }>(children)
    ? React.cloneElement(children, { id: inputId })
    : children;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {control}
    </div>
  );
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DemoState>(() => createInitialState());
  const [hydrated, setHydrated] = React.useState(false);
  const [dialog, setDialog] = React.useState<DemoDialogState | null>(null);
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(mergeSavedState(JSON.parse(saved) as Partial<DemoState>));
      }
    } catch {
      setState(createInitialState());
    } finally {
      setHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  React.useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        setState(mergeSavedState(JSON.parse(event.newValue) as Partial<DemoState>));
      } catch {
        setState(createInitialState());
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const notify = React.useCallback((title: string, description?: string) => {
    const id = createId("toast");
    setToasts((current) => [{ id, title, description }, ...current].slice(0, 3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const addActivity = React.useCallback((title: string, description: string) => {
    const activity = {
      id: createId("activity"),
      title,
      description,
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      activities: [activity, ...current.activities].slice(0, 10),
    }));
  }, []);

  const openDialog = React.useCallback(
    (type: DemoDialogType, payload?: Record<string, string>) => {
      setDialog({ type, payload });
    },
    []
  );

  const addNote = React.useCallback(
    (customer: string, body: string) => {
      const noteBody = body.trim();
      if (!noteBody) {
        notify("Empty note", "Write a note before saving it.");
        return;
      }

      const note = {
        id: createId("note"),
        customer,
        body: noteBody,
        createdAt: new Date().toISOString(),
      };
      setState((current) => ({
        ...current,
        notes: [note, ...current.notes],
      }));
      addActivity("Note saved", `${customer}: ${noteBody.slice(0, 80)}`);
      notify("Note saved", "The note is now visible in the customer profile.");
    },
    [addActivity, notify]
  );

  const createBookingRequest = React.useCallback(
    (input: DemoBookingInput) => {
      const customer = input.customer.trim() || "New web customer";
      const contactName = input.contactName.trim() || "Primary contact";
      const title = input.title.trim() || "Cleaning request";
      const city = input.city.trim() || "Madrid";
      const address = input.address.trim() || "Address pending";
      const preferredDate = input.preferredDate || addDays(5);
      const preferredTime = input.preferredTime || "10:00";
      const description =
        input.description.trim() || "Booking created from the public form.";
      const estimatedPrice = Number.isFinite(input.estimatedPrice)
        ? input.estimatedPrice
        : 650;
      const createdAt = new Date().toISOString();
      const requestId = createId("request");
      const leadId = createId("lead");
      const serviceId = createId("srv");
      const scheduledAt = new Date(`${preferredDate}T${preferredTime}:00`).toISOString();
      const serviceProfile = getServiceProfile({
        customer,
        description,
        title,
      });
      const serviceForRecommendation: DemoService = {
        id: serviceId,
        title,
        customer,
        status: "Pending",
        recurrence: "One-time",
        start: scheduledAt,
        team: ["Unassigned team"],
        city,
        price: estimatedPrice,
        vatRate: 21,
        address,
        assignmentMode: "Pending",
        description,
        estimatedDurationMinutes: serviceProfile.estimatedDurationMinutes,
        requiredSkills: serviceProfile.requiredSkills,
      };
      const recommendation = recommendAssignee({
        decisions: state.assignmentDecisions,
        employees: state.employees,
        service: serviceForRecommendation,
        services: state.services,
      });
      const canAutoAssign =
        recommendation.canAutoAssign && recommendation.employeeName !== "Unassigned team";
      const assignedTeam = canAutoAssign ? [recommendation.employeeName] : ["Unassigned team"];
      const suggestedTeam =
        recommendation.employeeName === "Unassigned team"
          ? ["Review availability"]
          : [recommendation.employeeName];
      const assignmentMode: DemoService["assignmentMode"] = canAutoAssign
        ? "Auto-assigned"
        : "Recommended";

      const request: DemoPortalRequest = {
        id: requestId,
        customer,
        title,
        preferredDate,
        description: `${address}. ${description}`,
        status: canAutoAssign ? "Autoasignado" : "Pending",
        createdAt,
        assignedTeam,
        assignmentMode,
        assignmentRecommendation: recommendation,
        leadId,
        scheduledAt,
        serviceId,
        suggestedTeam,
      };

      const lead: DemoLead = {
        id: leadId,
        status: "New",
        name: customer,
        companyName: customer,
        contactName,
        email: input.email.trim() || `contact@${slugify(customer)}.demo`,
        phone: input.phone.trim() || "+34 600 000 000",
        value: estimatedPrice,
        tags: canAutoAssign
          ? ["Web booking", "Auto-assigned", city]
          : ["Web booking", "Pending assignment", city],
        nextStep: canAutoAssign
          ? `Booking auto-assigned to ${recommendation.employeeName}. Review customer confirmation.`
          : `Review request and assign an employee. Recommended: ${suggestedTeam.join(", ")}`,
        createdAt,
      };

      const service: DemoService = {
        ...serviceForRecommendation,
        status: canAutoAssign ? "Scheduled" : "Pending",
        team: assignedTeam,
        assignmentMode,
        assignmentRecommendation: recommendation,
      };

      const note: DemoNote = {
        id: createId("note"),
        customer,
        body: `Web booking received: ${title}. Address: ${address}. Recommendation: ${recommendation.employeeName} (${recommendation.state}).`,
        createdAt,
      };
      const autoDecision: DemoAssignmentDecision | null = canAutoAssign
        ? {
            id: createId("decision"),
            serviceId,
            serviceTitle: title,
            serviceFamily: recommendation.serviceFamily,
            customer,
            city,
            recommendedEmployee: recommendation.employeeName,
            selectedEmployee: recommendation.employeeName,
            wasAcceptedByManager: true,
            decisionType: "auto-assigned",
            resultLabel: "Auto-assignment awaiting outcome.",
            createdAt,
            reasons: recommendation.reasons,
          }
        : null;

      setState((current) => {
        const nextState = {
          ...current,
          leads: [lead, ...current.leads],
          services: [service, ...current.services],
          portalRequests: [request, ...current.portalRequests],
          notes: [note, ...current.notes],
          assignmentDecisions: autoDecision
            ? [autoDecision, ...current.assignmentDecisions].slice(0, 80)
            : current.assignmentDecisions,
        };

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        return nextState;
      });
      addActivity("Web booking received", `${customer}: ${title}.`);
      if (canAutoAssign) {
        addActivity(
          "Auto-assignment applied",
          `${recommendation.employeeName} has been assigned through operational learning.`
        );
        notify("Booking auto-assigned", "Request, lead, and calendar updated with the assigned employee.");
      } else {
        addActivity(
          "Service awaiting assignment",
          `${title} is now in the calendar. Recommended: ${recommendation.employeeName}.`
        );
        notify("Booking received", "Request, lead, and calendar updated. Employee confirmation is still required.");
      }

      return { assignedTeam, leadId, requestId, scheduledAt, serviceId, suggestedTeam };
    },
    [addActivity, notify, state.assignmentDecisions, state.employees, state.services]
  );

  const downloadDocument = React.useCallback(
    (payload?: Record<string, string>) => {
      const invoice =
        state.invoices.find((item) => item.id === payload?.id) ?? state.invoices[0];
      const lines = [
        "WIAControl - Demo document",
        `Numero: ${payload?.number ?? invoice?.number ?? "DOC-DEMO"}`,
        `Customer: ${payload?.customer ?? invoice?.customer ?? "Atrium Labs"}`,
        `Status: ${payload?.status ?? invoice?.status ?? "Pending"}`,
        `Base imponible: ${invoice?.subtotal ?? 1200} EUR`,
        `VAT 21%: ${invoice?.vat ?? 252} EUR`,
        `Total: ${invoice?.total ?? 1452} EUR`,
        "",
        "This PDF is generated locally for the sales demo.",
      ];
      downloadBlob(
        `${payload?.number ?? invoice?.number ?? "demo-document"}.pdf`,
        createSimplePdf(lines),
        "application/pdf"
      );
      addActivity("PDF downloaded", payload?.number ?? invoice?.number ?? "Demo document");
      notify("PDF downloaded", "A local sample document has been generated.");
    },
    [addActivity, notify, state.invoices]
  );

  const convertQuoteToService = React.useCallback(
    (quoteId: string) => {
      const quote = state.quotes.find((item) => item.id === quoteId);
      if (!quote) return;

      const service: DemoService = {
        id: createId("srv"),
        title: `Service from ${quote.number}`,
        customer: quote.customer,
        status: "Pending",
        recurrence: "One-time",
        start: new Date(`${addDays(3)}T09:00:00`).toISOString(),
        team: ["Unassigned team"],
        city: "Madrid",
        price: Math.round(quote.total / 1.21),
        vatRate: 21,
      };

      setState((current) => ({
        ...current,
        services: [service, ...current.services],
        quotes: current.quotes.map((item) =>
          item.id === quoteId ? { ...item, status: "Aceptada" } : item
        ),
      }));
      addActivity("Quote converted", `${quote.number} has been converted into a service.`);
      notify("Quote converted", "The new service appears in Services and the Dashboard.");
    },
    [addActivity, notify, state.quotes]
  );

  const toggleAutomation = React.useCallback(
    (id: string, active: boolean) => {
      const nextStatus = active ? "Active" : "Paused";
      setState((current) => ({
        ...current,
        automations: current.automations.map((automation) =>
          automation.id === id ? { ...automation, status: nextStatus } : automation
        ),
      }));
      notify("Automation updated", `Status: ${nextStatus}.`);
    },
    [notify]
  );

  const updateServiceStatus = React.useCallback(
    (id: string, status: string) => {
      setState((current) => {
        const linkedRequest = current.portalRequests.find((request) => request.serviceId === id);
        const linkedLeadStatus = leadStatusFromOperationalStatus(status);

        return {
          ...current,
          services: current.services.map((service) =>
            service.id === id ? { ...service, status } : service
          ),
          portalRequests: current.portalRequests.map((request) =>
            request.serviceId === id ? { ...request, status } : request
          ),
          leads:
            linkedRequest?.leadId && linkedLeadStatus
              ? current.leads.map((lead) =>
                  lead.id === linkedRequest.leadId
                    ? {
                        ...lead,
                        status: linkedLeadStatus,
                        nextStep:
                          status === "Completed"
                            ? "Service completed. Request a review and propose recurrence."
                            : lead.nextStep,
                      }
                    : lead
                )
              : current.leads,
        };
      });
      notify("Service updated", `Status changed to ${status}.`);
    },
    [notify]
  );

  const updateLeadStatus = React.useCallback(
    (id: string, status: DemoLeadStatus) => {
      setState((current) => ({
        ...current,
        leads: current.leads.map((lead) => (lead.id === id ? { ...lead, status } : lead)),
      }));
      notify("Lead updated", `Status changed to ${status}.`);
    },
    [notify]
  );

  const updateEmployeeStatus = React.useCallback(
    (id: string, status: string) => {
      setState((current) => ({
        ...current,
        employees: current.employees.map((employee) =>
          employee.id === id ? { ...employee, status } : employee
        ),
      }));
      notify("Employee updated", `Status changed to ${status}.`);
    },
    [notify]
  );

  const updatePortalRequestStatus = React.useCallback(
    (id: string, status: string) => {
      setState((current) => {
        const request = current.portalRequests.find((item) => item.id === id);
        const linkedLeadStatus = leadStatusFromOperationalStatus(status);

        return {
          ...current,
          portalRequests: current.portalRequests.map((item) =>
            item.id === id ? { ...item, status } : item
          ),
          services: request?.serviceId
            ? current.services.map((service) =>
                service.id === request.serviceId ? { ...service, status } : service
              )
            : current.services,
          leads:
            request?.leadId && linkedLeadStatus
              ? current.leads.map((lead) =>
                  lead.id === request.leadId
                    ? {
                        ...lead,
                        status: linkedLeadStatus,
                        nextStep:
                          status === "Completed"
                            ? "Service completed. Request a review and offer maintenance."
                            : lead.nextStep,
                      }
                    : lead
                )
              : current.leads,
        };
      });
      notify("Request updated", `Status changed to ${status}.`);
    },
    [notify]
  );

  const deleteLead = React.useCallback(
    (leadId: string) => {
      const lead = state.leads.find((item) => item.id === leadId);
      setState((current) => ({
        ...current,
        leads: current.leads.filter((item) => item.id !== leadId),
        notes: lead
          ? current.notes.filter((note) => note.customer !== lead.companyName)
          : current.notes,
        portalRequests: current.portalRequests.map((request) =>
          request.leadId === leadId ? { ...request, leadId: undefined } : request
        ),
      }));
      addActivity("Lead deleted", `${lead?.companyName ?? "Lead"} removed from the pipeline.`);
      notify("Lead deleted", "It no longer appears in the sales CRM.");
    },
    [addActivity, notify, state.leads]
  );

  const deleteService = React.useCallback(
    (serviceId: string) => {
      const service = state.services.find((item) => item.id === serviceId);
      const linkedRequests = state.portalRequests.filter(
        (request) => request.serviceId === serviceId
      );
      const linkedLeadIds = new Set(
        linkedRequests.map((request) => request.leadId).filter(Boolean)
      );
      const linkedCustomers = new Set(
        [service?.customer, ...linkedRequests.map((request) => request.customer)].filter(Boolean)
      );

      setState((current) => ({
        ...current,
        services: current.services.filter((item) => item.id !== serviceId),
        notes: current.notes.filter((note) => !linkedCustomers.has(note.customer)),
        portalRequests: current.portalRequests.filter(
          (request) => request.serviceId !== serviceId
        ),
        leads: current.leads.filter((lead) => !linkedLeadIds.has(lead.id)),
        assignmentDecisions: current.assignmentDecisions.filter(
          (decision) => decision.serviceId !== serviceId
        ),
      }));
      addActivity("Service deleted", `${service?.title ?? "Service"} removed from the calendar.`);
      notify("Service deleted", "It was deleted together with its linked web request, if one existed.");
    },
    [addActivity, notify, state.portalRequests, state.services]
  );

  const deletePortalRequest = React.useCallback(
    (requestId: string) => {
      const request = state.portalRequests.find((item) => item.id === requestId);
      const linkedServiceId = request?.serviceId;
      const linkedLeadId = request?.leadId;

      setState((current) => ({
        ...current,
        portalRequests: current.portalRequests.filter((item) => item.id !== requestId),
        notes: request
          ? current.notes.filter((note) => note.customer !== request.customer)
          : current.notes,
        services: linkedServiceId
          ? current.services.filter((service) => service.id !== linkedServiceId)
          : current.services,
        leads: linkedLeadId
          ? current.leads.filter((lead) => lead.id !== linkedLeadId)
          : current.leads,
        assignmentDecisions: linkedServiceId
          ? current.assignmentDecisions.filter(
              (decision) => decision.serviceId !== linkedServiceId
            )
          : current.assignmentDecisions,
      }));
      addActivity("Web booking deleted", `${request?.customer ?? "Request"} removed from the demo.`);
      notify("Web booking deleted", "The linked calendar entry and lead were also removed.");
    },
    [addActivity, notify, state.portalRequests]
  );

  const deleteEmployee = React.useCallback(
    (employeeId: string) => {
      const employee = state.employees.find((item) => item.id === employeeId);
      const employeeName = employee?.name;

      setState((current) => ({
        ...current,
        employees: current.employees.filter((item) => item.id !== employeeId),
        services: current.services.map((service) => {
          const team = employeeName
            ? service.team.filter((member) => member !== employeeName)
            : service.team;

          return {
            ...service,
            status: team.length === 0 ? "Pending" : service.status,
            team: team.length > 0 ? team : ["Unassigned team"],
          };
        }),
        portalRequests: current.portalRequests.map((request) => {
          const assignedTeam = employeeName
            ? request.assignedTeam?.filter((member) => member !== employeeName)
            : request.assignedTeam;
          const suggestedTeam = employeeName
            ? request.suggestedTeam?.filter((member) => member !== employeeName)
            : request.suggestedTeam;

          return {
            ...request,
            assignedTeam: assignedTeam?.length ? assignedTeam : ["Unassigned team"],
            suggestedTeam: suggestedTeam?.length ? suggestedTeam : request.suggestedTeam,
            status: assignedTeam?.length ? request.status : "Pending",
          };
        }),
      }));
      addActivity("Employee deleted", `${employeeName ?? "Employee"} removed from the team.`);
      notify("Employee deleted", "Their services remain pending if they are left without a team.");
    },
    [addActivity, notify, state.employees]
  );

  const clearDemoScope = React.useCallback(
    (scope: "web" | "services" | "leads" | "employees" | "notes") => {
      const initial = createInitialState();
      const scopeLabels = {
        employees: "employees",
        leads: "leads",
        notes: "notes",
        services: "services",
        web: "web bookings",
      } as const;

      setState((current) => {
        if (scope === "web") {
          const serviceIds = new Set(
            current.portalRequests.map((request) => request.serviceId).filter(Boolean)
          );
          const leadIds = new Set(
            current.portalRequests.map((request) => request.leadId).filter(Boolean)
          );
          const requestCustomers = new Set(
            current.portalRequests.map((request) => request.customer)
          );

          return {
            ...current,
            leads: current.leads.filter((lead) => !leadIds.has(lead.id)),
            notes: current.notes.filter((note) => !requestCustomers.has(note.customer)),
            services: current.services.filter((service) => !serviceIds.has(service.id)),
            portalRequests: [],
            assignmentDecisions: current.assignmentDecisions.filter(
              (decision) => !serviceIds.has(decision.serviceId)
            ),
          };
        }

        if (scope === "services") {
          return {
            ...current,
            notes: initial.notes,
            services: initial.services,
            portalRequests: [],
            assignmentDecisions: initial.assignmentDecisions,
          };
        }

        if (scope === "leads") {
          return {
            ...current,
            leads: initial.leads,
            portalRequests: current.portalRequests.map((request) => ({
              ...request,
              leadId: undefined,
            })),
          };
        }

        if (scope === "employees") {
          const employeeNames = new Set(initial.employees.map((employee) => employee.name));

          return {
            ...current,
            employees: initial.employees,
            services: current.services.map((service) => {
              const team = service.team.filter((member) => employeeNames.has(member));
              return {
                ...service,
                team: team.length > 0 ? team : ["Unassigned team"],
              };
            }),
          };
        }

        return {
          ...current,
          notes: [],
        };
      });

      addActivity("Demo data cleared", `Cleared section: ${scopeLabels[scope]}.`);
      notify("Data cleared", `Cleared section: ${scopeLabels[scope]}.`);
    },
    [addActivity, notify]
  );

  const assignServiceTeam = React.useCallback(
    (serviceId: string, employeeName: string) => {
      const nextTeam = employeeName ? [employeeName] : ["Unassigned team"];
      const serviceBefore = state.services.find((service) => service.id === serviceId);
      const recommendationBefore = serviceBefore
        ? recommendAssignee({
            decisions: state.assignmentDecisions,
            employees: state.employees,
            service: serviceBefore,
            services: state.services,
          })
        : null;
      const recommendedEmployee =
        recommendationBefore?.employeeName &&
        recommendationBefore.employeeName !== "Unassigned team"
          ? recommendationBefore.employeeName
          : undefined;
      const acceptedRecommendation = Boolean(
        employeeName && recommendedEmployee && employeeName === recommendedEmployee
      );

      setState((current) => {
        const previousService = current.services.find((service) => service.id === serviceId);
        const nextStatus = employeeName ? "Scheduled" : "Pending";
        const recommendation = previousService
          ? recommendAssignee({
              decisions: current.assignmentDecisions,
              employees: current.employees,
              service: previousService,
              services: current.services,
            })
          : null;
        const selectedEmployee = employeeName.trim();
        const currentRecommendedEmployee =
          recommendation?.employeeName && recommendation.employeeName !== "Unassigned team"
            ? recommendation.employeeName
            : undefined;
        const assignmentMode: DemoService["assignmentMode"] = selectedEmployee
          ? selectedEmployee === currentRecommendedEmployee
            ? "Recommended"
            : "Manual"
          : "Pending";
        const shouldRecordDecision = Boolean(
          previousService &&
            selectedEmployee &&
            !previousService.team.includes(selectedEmployee)
        );
        const decision: DemoAssignmentDecision | null =
          previousService && recommendation && shouldRecordDecision
            ? {
                id: createId("decision"),
                serviceId,
                serviceTitle: previousService.title,
                serviceFamily: recommendation.serviceFamily,
                customer: previousService.customer,
                city: previousService.city,
                recommendedEmployee: currentRecommendedEmployee,
                selectedEmployee,
                wasAcceptedByManager: selectedEmployee === currentRecommendedEmployee,
                decisionType:
                  selectedEmployee === currentRecommendedEmployee
                    ? "manager-confirmed"
                    : "manager-override",
                resultLabel: "Awaiting operational outcome.",
                createdAt: new Date().toISOString(),
                reasons: recommendation.reasons,
              }
            : null;

        return {
          ...current,
          services: current.services.map((service) =>
            service.id === serviceId
              ? {
                  ...service,
                  assignmentMode,
                  assignmentRecommendation: recommendation ?? service.assignmentRecommendation,
                  status: service.status === "Completed" ? service.status : nextStatus,
                  team: nextTeam,
                }
              : service
          ),
          portalRequests: current.portalRequests.map((request) =>
            request.serviceId === serviceId
              ? {
                  ...request,
                  assignedTeam: nextTeam,
                  assignmentMode,
                  assignmentRecommendation:
                    recommendation ?? request.assignmentRecommendation,
                  status: employeeName ? "Scheduled" : "Pending",
                }
              : request
          ),
          assignmentDecisions: decision
            ? [decision, ...current.assignmentDecisions].slice(0, 80)
            : current.assignmentDecisions,
          employees: current.employees.map((employee) => {
            const wasAlreadyAssigned = previousService?.team.includes(employee.name);
            const isNowAssigned = nextTeam.includes(employee.name);

            if (!isNowAssigned || wasAlreadyAssigned) {
              return employee;
            }

            return {
              ...employee,
              status: "Assigned",
              jobs: employee.jobs + 1,
              revenue: employee.revenue + Math.round((previousService?.price ?? 0) / nextTeam.length),
            };
          }),
        };
      });

      if (employeeName) {
        addActivity(
          acceptedRecommendation ? "Recommendation accepted" : "Manual assignment saved",
          `${employeeName} has been assigned to the service.`
        );
        notify(
          acceptedRecommendation ? "Recommendation accepted" : "Change saved",
          acceptedRecommendation
            ? "The system stores it as learning for future bookings."
            : "The correction is stored to adjust future recommendations."
        );
      } else {
        notify("Assignment pending", "The service is awaiting a team.");
      }
    },
    [addActivity, notify, state.assignmentDecisions, state.employees, state.services]
  );

  const getAssignmentRecommendation = React.useCallback(
    (serviceId: string) => {
      const service = state.services.find((item) => item.id === serviceId);

      if (!service) {
        return null;
      }

      return recommendAssignee({
        decisions: state.assignmentDecisions,
        employees: state.employees,
        service,
        services: state.services,
      });
    },
    [state.assignmentDecisions, state.employees, state.services]
  );

  const rescheduleService = React.useCallback(
    (serviceId: string, date: string) => {
      const service = state.services.find((item) => item.id === serviceId);
      if (!service) return;

      const nextDate = datePart(date, service.start.slice(0, 10));
      const nextStart = new Date(`${nextDate}T${timePart(service.start)}:00`).toISOString();

      setState((current) => ({
        ...current,
        services: current.services.map((item) =>
          item.id === serviceId ? { ...item, start: nextStart } : item
        ),
        portalRequests: current.portalRequests.map((request) =>
          request.serviceId === serviceId
            ? {
                ...request,
                preferredDate: nextDate,
                scheduledAt: nextStart,
              }
            : request
        ),
      }));
      addActivity("Service rescheduled", `${service.title} moved to ${nextDate}.`);
      notify("Calendar updated", "Service, web request, and operational views remain synchronized.");
    },
    [addActivity, notify, state.services]
  );

  const resetDemo = React.useCallback(() => {
    const initial = createInitialState();
    setState(initial);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    notify("Demo reset", "The initial data has been restored.");
  }, [notify]);

  const runAction = React.useCallback(
    (action: DemoAction, payload?: Record<string, string>) => {
      switch (action) {
        case "export-dashboard": {
          const rows = [
            ["type", "name", "customer", "status", "total"],
            ...state.services.map((service) => [
              "service",
              service.title,
              service.customer,
              service.status,
              service.price,
            ]),
            ...state.invoices.map((invoice) => [
              "invoice",
              invoice.number,
              invoice.customer,
              invoice.status,
              invoice.total,
            ]),
          ];
          downloadBlob(
            "wia-control-export-demo.csv",
            rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
            "text/csv;charset=utf-8"
          );
          addActivity("Export generated", "Local CSV with services and invoices.");
          notify("Export ready", "A CSV containing the demo data has been downloaded.");
          break;
        }
        case "filters":
          notify("Filters applied", "The view is ready for segmentation by status and tag.");
          addActivity("Filters reviewed", "Sales view prepared for the demo.");
          break;
        case "new-lead":
          openDialog("lead");
          break;
        case "new-service":
          openDialog("service", payload);
          break;
        case "new-employee":
          openDialog("employee");
          break;
        case "new-quote":
          openDialog("quote", payload);
          break;
        case "new-invoice":
          openDialog("invoice", payload);
          break;
        case "download-document":
          downloadDocument(payload);
          break;
        case "billing-portal":
          notify("Billing portal opened", "The local demo simulates entering the Stripe portal.");
          addActivity("Stripe portal demo", "Subscription management simulated locally.");
          break;
        case "new-automation":
          openDialog("automation");
          break;
        case "request-service":
          openDialog("request");
          break;
        case "analytics":
          notify("Analytics generated", "MRR, churn, and companies are ready for the demo walkthrough.");
          addActivity("Analytics reviewed", "SaaS dashboard reviewed by the super administrator.");
          break;
        case "google-calendar":
          notify("Integration ready", "The Google Calendar connection is simulated for pre-production.");
          addActivity("Google Calendar demo", "Synchronization prepared for real credentials.");
          break;
        case "new-visit":
          openDialog("visit");
          break;
        case "settings":
          notify("Settings opened", "Company settings simulated for the local demo.");
          addActivity("Settings reviewed", "Workspace preferences reviewed.");
          break;
        case "notifications":
          notify("Operational alerts", "2 critical services, 1 overdue invoice, and 1 failed payment.");
          break;
        case "save-note":
          openDialog("note", payload);
          break;
      }
    },
    [addActivity, downloadDocument, notify, openDialog, state.invoices, state.services]
  );

  const submitDialog = React.useCallback(
    (formData: FormData) => {
      if (!dialog) return;

      const editingId = dialog.payload?.id;

      if (dialog.type === "lead") {
        const existingLead = state.leads.find((item) => item.id === editingId);
        const companyName = textFrom(formData.get("companyName"), "New lead");
        const lead: DemoLead = {
          id: editingId ?? createId("lead"),
          status: textFrom(formData.get("status"), "New") as DemoLeadStatus,
          name: companyName,
          companyName,
          contactName: textFrom(formData.get("contactName"), "Primary contact"),
          email: textFrom(formData.get("email"), `contact@${slugify(companyName)}.demo`),
          phone: textFrom(formData.get("phone"), "+34 600 000 000"),
          value: numberFrom(formData.get("value"), 1800),
          tags: csvListFrom(textFrom(formData.get("tags"), "Demo")),
          nextStep: textFrom(formData.get("nextStep"), "Send quote"),
          createdAt: existingLead?.createdAt ?? new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          leads: editingId
            ? current.leads.map((item) => (item.id === editingId ? lead : item))
            : [lead, ...current.leads],
        }));
        addActivity(
          editingId ? "Lead updated" : "Lead created",
          `${lead.companyName} ${editingId ? "updated" : "added to the pipeline"}.`
        );
        notify(
          editingId ? "Lead updated" : "Lead created",
          editingId ? "The changes have been saved in the CRM." : "It appears in the sales pipeline."
        );
      }

      if (dialog.type === "service" || dialog.type === "visit") {
        const existingService = state.services.find((item) => item.id === editingId);
        const title = textFrom(
          formData.get("title"),
          dialog.type === "visit" ? "New visit" : "Cleaning service"
        );
        const customer = textFrom(
          formData.get("customer"),
          dialog.payload?.customer ?? "Atrium Labs"
        );
        const date = textFrom(formData.get("date"), datePart(existingService?.start));
        const time = textFrom(formData.get("time"), timePart(existingService?.start));
        const team = csvListFrom(textFrom(formData.get("team"), "Unassigned team"), [
          "Unassigned team",
        ]);
        const service: DemoService = {
          ...existingService,
          id: editingId ?? createId("srv"),
          title,
          customer,
          status: textFrom(formData.get("status"), "Scheduled"),
          recurrence: textFrom(formData.get("recurrence"), "One-time"),
          start: new Date(`${date}T${time}:00`).toISOString(),
          team,
          city: textFrom(formData.get("city"), "Madrid"),
          price: numberFrom(formData.get("price"), 650),
          vatRate: existingService?.vatRate ?? 21,
        };
        setState((current) => {
          const linkedRequest = editingId
            ? current.portalRequests.find((request) => request.serviceId === editingId)
            : undefined;
          const linkedLeadStatus = leadStatusFromOperationalStatus(service.status);

          return {
            ...current,
            services: editingId
              ? current.services.map((item) => (item.id === editingId ? service : item))
              : [service, ...current.services],
            portalRequests: editingId
              ? current.portalRequests.map((request) =>
                  request.serviceId === editingId
                    ? {
                        ...request,
                        assignedTeam: team,
                        customer,
                        preferredDate: date,
                        scheduledAt: service.start,
                        status: service.status,
                        title,
                      }
                    : request
                )
              : current.portalRequests,
            leads:
              linkedRequest?.leadId && linkedLeadStatus
                ? current.leads.map((lead) =>
                    lead.id === linkedRequest.leadId
                      ? {
                          ...lead,
                          companyName: customer,
                          name: customer,
                          status: linkedLeadStatus,
                          tags: ["Web booking", service.city, service.status],
                          value: service.price,
                        }
                      : lead
                  )
                : current.leads,
          };
        });
        addActivity(
          editingId ? "Service updated" : "Service created",
          `${service.title} for ${service.customer}.`
        );
        notify(
          editingId ? "Service updated" : "Service created",
          editingId
            ? "Calendar, team, and status remain synchronized."
            : "It now appears in Services, Dashboard, and Portal."
        );
      }

      if (dialog.type === "employee") {
        const existingEmployee = state.employees.find((item) => item.id === editingId);
        const previousName = existingEmployee?.name;
        const employee: DemoEmployee = {
          ...existingEmployee,
          id: editingId ?? createId("emp"),
          name: textFrom(formData.get("name"), "New employee"),
          role: textFrom(formData.get("role"), "Operario/a"),
          status: textFrom(formData.get("status"), "Available"),
          availability: textFrom(formData.get("availability"), "Mon-Fri 08:00-16:00"),
          jobs: existingEmployee?.jobs ?? 0,
          score: existingEmployee?.score ?? 90,
          revenue: existingEmployee?.revenue ?? 0,
          notes: textFrom(formData.get("notes"), "Employee created from the local demo."),
        };
        const renameTeamMember = (member: string) =>
          previousName && member === previousName ? employee.name : member;

        setState((current) => ({
          ...current,
          employees: editingId
            ? current.employees.map((item) => (item.id === editingId ? employee : item))
            : [employee, ...current.employees],
          services: previousName
            ? current.services.map((service) => ({
                ...service,
                team: service.team.map(renameTeamMember),
              }))
            : current.services,
          portalRequests: previousName
            ? current.portalRequests.map((request) => ({
                ...request,
                assignedTeam: request.assignedTeam?.map(renameTeamMember),
                suggestedTeam: request.suggestedTeam?.map(renameTeamMember),
              }))
            : current.portalRequests,
        }));
        addActivity(
          editingId ? "Employee updated" : "Employee created",
          `${employee.name} ${editingId ? "updated" : "added to the team"}.`
        );
        notify(
          editingId ? "Employee updated" : "Employee created",
          editingId ? "Their assignments remain up to date." : "They were added to the field team list."
        );
      }

      if (dialog.type === "quote") {
        const total = numberFrom(formData.get("total"), 1200);
        const quote: DemoQuote = {
          id: createId("quote"),
          number: `P-${new Date().getFullYear()}-${String(state.quotes.length + 49).padStart(4, "0")}`,
          customer: textFrom(formData.get("customer"), dialog.payload?.customer ?? "Atrium Labs"),
          status: "Draft",
          total,
          validUntil: textFrom(formData.get("validUntil"), addDays(14)),
        };
        setState((current) => ({ ...current, quotes: [quote, ...current.quotes] }));
        addActivity("Quote created", `${quote.number} for ${quote.customer}.`);
        notify("Quote created", "You can convert it into a service from Billing.");
      }

      if (dialog.type === "invoice") {
        const subtotal = numberFrom(formData.get("subtotal"), 1000);
        const vat = subtotal * 0.21;
        const invoice: DemoInvoice = {
          id: createId("inv"),
          number: `F-${new Date().getFullYear()}-${String(state.invoices.length + 143).padStart(4, "0")}`,
          customer: textFrom(formData.get("customer"), dialog.payload?.customer ?? "Atrium Labs"),
          status: textFrom(formData.get("status"), "Pending"),
          dueDate: textFrom(formData.get("dueDate"), addDays(7)),
          subtotal,
          vat,
          total: subtotal + vat,
        };
        setState((current) => ({ ...current, invoices: [invoice, ...current.invoices] }));
        addActivity("Invoice created", `${invoice.number} for ${invoice.customer}.`);
        notify("Invoice created", "The invoice is available to download as a PDF.");
      }

      if (dialog.type === "note") {
        addNote(
          textFrom(formData.get("customer"), dialog.payload?.customer ?? "Atrium Labs"),
          textFrom(formData.get("body"))
        );
      }

      if (dialog.type === "request") {
        const customer = textFrom(formData.get("customer"), "Atrium Labs");
        const contactName = textFrom(formData.get("contactName"), "Marta Soler");
        const email = textFrom(formData.get("email"), "marta@atriumlabs.com");
        const phone = textFrom(formData.get("phone"), "+34 611 204 338");
        const title = textFrom(formData.get("title"), "Cleaning request");
        const city = textFrom(formData.get("city"), "Madrid");
        const address = textFrom(formData.get("address"), "Calle Serrano 42, Madrid");
        const preferredDate = textFrom(formData.get("preferredDate"), addDays(5));
        const preferredTime = textFrom(formData.get("preferredTime"), "10:00");
        const description = textFrom(
          formData.get("description"),
          "Request created from the customer portal."
        );
        const estimatedPrice = numberFrom(formData.get("estimatedPrice"), 680);
        const status = textFrom(formData.get("status"), "Pending");
        const scheduledAt = new Date(`${preferredDate}T${preferredTime}:00`).toISOString();

        if (editingId) {
          const request = state.portalRequests.find((item) => item.id === editingId);
          const serviceProfile = getServiceProfile({ customer, description, title });

          setState((current) => ({
            ...current,
            portalRequests: current.portalRequests.map((item) =>
              item.id === editingId
                ? {
                    ...item,
                    customer,
                    description: `${address}. ${description}`,
                    preferredDate,
                    scheduledAt,
                    status,
                    title,
                  }
                : item
            ),
            services: request?.serviceId
              ? current.services.map((service) =>
                  service.id === request.serviceId
                    ? {
                        ...service,
                        address,
                        city,
                        customer,
                        description,
                        estimatedDurationMinutes: serviceProfile.estimatedDurationMinutes,
                        price: estimatedPrice,
                        requiredSkills: serviceProfile.requiredSkills,
                        start: scheduledAt,
                        status:
                          status === "Pending" || status === "Cancelled"
                            ? status
                            : service.status,
                        title,
                      }
                    : service
                )
              : current.services,
            leads: request?.leadId
              ? current.leads.map((lead) =>
                  lead.id === request.leadId
                    ? {
                        ...lead,
                        companyName: customer,
                        contactName,
                        email,
                        name: customer,
                        nextStep:
                          status === "Pending"
                            ? "Review the web request and confirm the team."
                            : lead.nextStep,
                        phone,
                        tags: ["Web booking", city, status],
                        value: estimatedPrice,
                      }
                    : lead
                )
              : current.leads,
          }));
          addActivity("Web booking updated", `${customer}: ${title}.`);
          notify("Booking updated", "Request, lead, and calendar remain synchronized.");
        } else if (dialog.payload?.legacy === "true") {
          const request: DemoPortalRequest = {
            id: createId("request"),
            customer,
            title,
            preferredDate,
            description,
            status: "Pending",
            createdAt: new Date().toISOString(),
          };
          setState((current) => ({
            ...current,
            portalRequests: [request, ...current.portalRequests],
          }));
          addActivity("Request received", `${customer}: ${title}.`);
          notify("Request sent", "It appears in the portal as a pending request.");
        } else {
          createBookingRequest({
            customer,
            contactName,
            email,
            phone,
            title,
            city,
            address,
            preferredDate,
            preferredTime,
            description,
            estimatedPrice,
          });
        }
      }

      if (dialog.type === "automation") {
        const automation: DemoAutomation = {
          id: createId("automation"),
          name: textFrom(formData.get("name"), "New automation"),
          trigger: textFrom(formData.get("trigger"), "FOLLOW_UP"),
          channel: textFrom(formData.get("channel"), "Email"),
          status: "Active",
          sent: 0,
          conversion: "0 %",
        };
        setState((current) => ({
          ...current,
          automations: [automation, ...current.automations],
        }));
        addActivity("Automation created", `${automation.name} activated.`);
        notify("Automation created", "You can pause or activate it from the dashboard.");
      }

      setDialog(null);
    },
    [addActivity, addNote, createBookingRequest, dialog, notify, state]
  );

  const customers = React.useMemo(() => buildDemoCustomers(state), [state]);

  const value = React.useMemo<DemoContextValue>(
    () => ({
      ...state,
      customers,
      addNote,
      assignServiceTeam,
      clearDemoScope,
      convertQuoteToService,
      createBookingRequest,
      deleteEmployee,
      deleteLead,
      deletePortalRequest,
      deleteService,
      downloadDocument,
      getAssignmentRecommendation,
      notify,
      openDialog,
      rescheduleService,
      resetDemo,
      runAction,
      toggleAutomation,
      updateEmployeeStatus,
      updateLeadStatus,
      updatePortalRequestStatus,
      updateServiceStatus,
    }),
    [
      addNote,
      assignServiceTeam,
      clearDemoScope,
      convertQuoteToService,
      createBookingRequest,
      customers,
      deleteEmployee,
      deleteLead,
      deletePortalRequest,
      deleteService,
      downloadDocument,
      getAssignmentRecommendation,
      notify,
      openDialog,
      rescheduleService,
      resetDemo,
      runAction,
      state,
      toggleAutomation,
      updateEmployeeStatus,
      updateLeadStatus,
      updatePortalRequestStatus,
      updateServiceStatus,
    ]
  );

  return (
    <DemoContext.Provider value={value}>
      {children}
      <DemoDialogHost dialog={dialog} onClose={() => setDialog(null)} onSubmit={submitDialog} />
      <div className="fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="rounded-lg border border-border bg-card/95 p-3 text-sm shadow-lg backdrop-blur"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 text-primary" />
              <div>
                <p className="font-medium">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-1 text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!hydrated ? (
        <div className="fixed bottom-4 left-4 z-40 hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm md:flex">
          <Loader2 className="size-3 animate-spin" />
          Preparando demo local
        </div>
      ) : null}
    </DemoContext.Provider>
  );
}

function DemoDialogHost({
  dialog,
  onClose,
  onSubmit,
}: {
  dialog: DemoDialogState | null;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const editing = Boolean(dialog?.payload?.id);
  const title = dialog
    ? editing
      ? dialogEditTitles[dialog.type] ?? dialogTitles[dialog.type]
      : dialogTitles[dialog.type]
    : "";
  const description = dialog ? dialogDescriptions[dialog.type] : "";

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(new FormData(event.currentTarget));
          }}
        >
          {dialog ? <DialogFields dialog={dialog} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{editing ? "Update" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const dialogTitles: Record<DemoDialogType, string> = {
  lead: "New lead",
  service: "Create service",
  employee: "New employee",
  quote: "New quote",
  invoice: "New invoice",
  note: "Save note",
  request: "Request service",
  automation: "New automation",
  visit: "New visit",
};

const dialogEditTitles: Partial<Record<DemoDialogType, string>> = {
  employee: "Edit employee",
  lead: "Edit lead",
  request: "Edit web booking",
  service: "Edit service",
  visit: "Edit visit",
};

const dialogDescriptions: Record<DemoDialogType, string> = {
  lead: "Create a sales opportunity visible in the pipeline.",
  service: "Schedule a cleaning service with a team, city, and amount.",
  employee: "Add a person to the field team.",
  quote: "Generate a VAT-inclusive quote ready to convert into a service.",
  invoice: "Create an invoice that can be downloaded as a local PDF.",
  note: "Record a sales or operational note in the customer profile.",
  request: "Simulate a request from the customer portal.",
  automation: "Configure an automatic email, SMS, or follow-up rule.",
  visit: "Create an operational visit from the calendar.",
};

function DialogFields({ dialog }: { dialog: DemoDialogState }) {
  if (dialog.type === "lead") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Company">
          <Input name="companyName" defaultValue={payloadText(dialog, "companyName", "Residencial Prado")} required />
        </FormField>
        <FormField label="Contact">
          <Input name="contactName" defaultValue={payloadText(dialog, "contactName", "Ana Martín")} />
        </FormField>
        <FormField label="Email">
          <Input name="email" type="email" defaultValue={payloadText(dialog, "email", "ana@residentialprado.demo")} />
        </FormField>
        <FormField label="Phone">
          <Input name="phone" defaultValue={payloadText(dialog, "phone", "+34 622 140 900")} />
        </FormField>
        <FormField label="Status">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "New")}
            options={["New", "Qualified", "Quote", "Won"]}
          />
        </FormField>
        <FormField label="Estimated value">
          <Input name="value" type="number" defaultValue={payloadText(dialog, "value", "1850")} min="0" />
        </FormField>
        <FormField label="Etiquetas">
          <Input name="tags" defaultValue={payloadText(dialog, "tags", "Madrid, Community")} />
        </FormField>
        <FormField label="Next step">
          <Input name="nextStep" defaultValue={payloadText(dialog, "nextStep", "Send proposal this week")} />
        </FormField>
      </div>
    );
  }

  if (dialog.type === "service" || dialog.type === "visit") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Service">
          <Input
            name="title"
            defaultValue={payloadText(
              dialog,
              "title",
              dialog.type === "visit" ? "Supervision visit" : "Recurring cleaning"
            )}
            required
          />
        </FormField>
        <FormField label="Customer">
          <Input name="customer" defaultValue={dialog.payload?.customer ?? "Atrium Labs"} />
        </FormField>
        <FormField label="City">
          <Input name="city" defaultValue={payloadText(dialog, "city", "Madrid")} />
        </FormField>
        <FormField label="Status">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "Scheduled")}
            options={["Pending", "Scheduled", "In progress", "Completed", "Cancelled"]}
          />
        </FormField>
        <FormField label="Date">
          <Input name="date" type="date" defaultValue={payloadText(dialog, "date", addDays(1))} />
        </FormField>
        <FormField label="Time">
          <Input name="time" type="time" defaultValue={payloadText(dialog, "time", "09:00")} />
        </FormField>
        <FormField label="Recurrencia">
          <DemoNativeSelect
            name="recurrence"
            defaultValue={payloadText(dialog, "recurrence", dialog.type === "visit" ? "One-time" : "Weekly")}
            options={["One-time", "Daily", "Weekly", "Monthly"]}
          />
        </FormField>
        <FormField label="Amount before VAT">
          <Input name="price" type="number" defaultValue={payloadText(dialog, "price", "650")} min="0" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Team">
            <Input name="team" defaultValue={payloadText(dialog, "team", "Laura Méndez, Nadia Ramos")} />
          </FormField>
        </div>
      </div>
    );
  }

  if (dialog.type === "employee") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name">
          <Input name="name" defaultValue={payloadText(dialog, "name", "Sara Molina")} required />
        </FormField>
        <FormField label="Role">
          <Input name="role" defaultValue={payloadText(dialog, "role", "Specialist operator")} />
        </FormField>
        <FormField label="Status">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "Available")}
            options={["Available", "Assigned", "Holiday", "Sick leave"]}
          />
        </FormField>
        <FormField label="Availability">
          <Input name="availability" defaultValue={payloadText(dialog, "availability", "Mon-Fri 08:00-16:00")} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Internal notes">
            <Input name="notes" defaultValue={payloadText(dialog, "notes", "Added for premium office support.")} />
          </FormField>
        </div>
      </div>
    );
  }

  if (dialog.type === "quote") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Customer">
          <Input name="customer" defaultValue={dialog.payload?.customer ?? "Alameda Clinic"} />
        </FormField>
        <FormField label="Total including VAT">
          <Input name="total" type="number" defaultValue="1452" min="0" />
        </FormField>
        <FormField label="Valid until">
          <Input name="validUntil" type="date" defaultValue={addDays(14)} />
        </FormField>
      </div>
    );
  }

  if (dialog.type === "invoice") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Customer">
          <Input name="customer" defaultValue={dialog.payload?.customer ?? "Atrium Labs"} />
        </FormField>
        <FormField label="Base imponible">
          <Input name="subtotal" type="number" defaultValue="1200" min="0" />
        </FormField>
        <FormField label="Status">
          <DemoNativeSelect
            name="status"
            defaultValue="Pending"
            options={["Pending", "Paid", "Overdue"]}
          />
        </FormField>
        <FormField label="Vencimiento">
          <Input name="dueDate" type="date" defaultValue={addDays(7)} />
        </FormField>
      </div>
    );
  }

  if (dialog.type === "note") {
    return (
      <div className="space-y-4">
        <input type="hidden" name="customer" value={dialog.payload?.customer ?? "Atrium Labs"} />
        <Badge variant="outline" className="rounded-md">
          {dialog.payload?.customer ?? "Atrium Labs"}
        </Badge>
        <FormField label="Note">
          <Textarea name="body" className="min-h-32" placeholder="Write a note for the team..." />
        </FormField>
      </div>
    );
  }

  if (dialog.type === "request") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Customer">
          <Input name="customer" defaultValue={payloadText(dialog, "customer", "Atrium Labs")} />
        </FormField>
        <FormField label="Contact">
          <Input name="contactName" defaultValue={payloadText(dialog, "contactName", "Marta Soler")} />
        </FormField>
        <FormField label="Email">
          <Input name="email" type="email" defaultValue={payloadText(dialog, "email", "marta@atriumlabs.com")} />
        </FormField>
        <FormField label="Phone">
          <Input name="phone" defaultValue={payloadText(dialog, "phone", "+34 611 204 338")} />
        </FormField>
        <FormField label="Requested service">
          <Input name="title" defaultValue={payloadText(dialog, "title", "Extra window cleaning")} />
        </FormField>
        <FormField label="City">
          <Input name="city" defaultValue={payloadText(dialog, "city", "Madrid")} />
        </FormField>
        <FormField label="Address">
          <Input name="address" defaultValue={payloadText(dialog, "address", "Calle Serrano 42, Madrid")} />
        </FormField>
        <FormField label="Status">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "Pending")}
            options={["Pending", "Scheduled", "Autoasignado", "Completed", "Cancelled"]}
          />
        </FormField>
        <FormField label="Preferred date">
          <Input name="preferredDate" type="date" defaultValue={payloadText(dialog, "preferredDate", addDays(5))} />
        </FormField>
        <FormField label="Preferred time">
          <Input name="preferredTime" type="time" defaultValue={payloadText(dialog, "preferredTime", "10:00")} />
        </FormField>
        <FormField label="Estimated amount">
          <Input name="estimatedPrice" type="number" defaultValue={payloadText(dialog, "estimatedPrice", "680")} min="0" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Description">
            <Textarea
              name="description"
              defaultValue={payloadText(
                dialog,
                "description",
                "We need an extra visit before the monthly meeting."
              )}
            />
          </FormField>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Name">
        <Input name="name" defaultValue="Opportunity follow-up" required />
      </FormField>
      <FormField label="Disparador">
        <DemoNativeSelect
          name="trigger"
          defaultValue="FOLLOW_UP"
          options={["SERVICE_REMINDER", "SERVICE_CONFIRMATION", "FOLLOW_UP", "REVIEW_REQUEST", "FAILED_PAYMENT"]}
        />
      </FormField>
      <FormField label="Canal">
        <DemoNativeSelect name="channel" defaultValue="Email" options={["Email", "Email + SMS", "SMS"]} />
      </FormField>
    </div>
  );
}

export function useDemo() {
  const context = React.useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used inside DemoProvider");
  }
  return context;
}

export function DemoActionButton({
  action,
  payload,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & {
  action: DemoAction;
  payload?: Record<string, string>;
}) {
  const { runAction } = useDemo();

  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          runAction(action, payload);
        }
      }}
    />
  );
}
