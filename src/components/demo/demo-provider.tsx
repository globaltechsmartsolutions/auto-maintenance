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

const STORAGE_KEY = "limpiapro-demo-local-state-v2";

export type DemoLeadStatus = "Nuevo" | "Cualificado" | "Presupuesto" | "Ganado";
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
  assignmentMode?: "Pendiente" | "Recomendada" | "Manual" | "Autoasignada";
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
  assignmentMode?: "Pendiente" | "Recomendada" | "Manual" | "Autoasignada";
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

// Mantener este contrato estable: las pantallas hablan con esta fachada.
// En producción se sustituye la implementación local por llamadas API/Supabase,
// sin reescribir las páginas del CRM.
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
  return slugify(value || "cliente");
}

function addUnique(values: string[], nextValue?: string) {
  const cleanValue = nextValue?.trim();
  if (cleanValue && !values.includes(cleanValue)) {
    values.push(cleanValue);
  }
}

function leadStatusFromOperationalStatus(status: string): DemoLeadStatus | null {
  if (status === "Completado") return "Ganado";
  if (status === "Programado" || status === "Autoasignado" || status === "En curso") {
    return "Cualificado";
  }
  if (status === "Pendiente") return "Nuevo";
  return null;
}

function inferCustomerType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("hotel")) return "Hotel";
  if (normalized.includes("clínica") || normalized.includes("clinica")) return "Sanitario";
  if (normalized.includes("comunidad") || normalized.includes("residencial")) return "Comunidad";
  if (normalized.includes("obra")) return "Final de obra";
  return "Cliente";
}

function createGeneratedCustomer(name: string): CustomerAccumulator {
  const normalizedName = name.trim() || "Cliente demo";

  return {
    id: `cust-${normalizeCustomerKey(normalizedName)}`,
    name: normalizedName,
    type: inferCustomerType(normalizedName),
    contact: "Contacto principal",
    email: `contacto@${normalizeCustomerKey(normalizedName)}.demo`,
    phone: "+34 600 000 000",
    status: "En seguimiento",
    tags: ["Demo local"],
    lifetimeValue: 0,
    nextService: "",
    address: "Dirección pendiente",
    risk: "Bajo",
    notes: "Cliente creado automáticamente desde la demo local.",
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

    customer.hasOpenService ||= !["Cancelado", "Completado"].includes(service.status);
    customer.hasPendingWork ||= service.status === "Pendiente";
    customer.type =
      customer.type === "Cliente" ? inferCustomerType(`${service.customer} ${service.title}`) : customer.type;
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
    customer.hasOverdueInvoice ||= invoice.status === "Vencida";
    customer.hasPendingWork ||= invoice.status === "Pendiente";
  });

  state.quotes.forEach((quote) => {
    const customer = ensureCustomer(quote.customer);
    addUnique(customer.tags, "Presupuesto");
  });

  state.portalRequests.forEach((request) => {
    const customer = ensureCustomer(request.customer);
    customer.hasPendingWork ||= request.status === "Pendiente";
    customer.nextDates.push(request.scheduledAt ?? request.preferredDate);
    addUnique(customer.tags, "Reserva web");
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
      ? "En seguimiento"
      : customer.hasOpenService
        ? "Activo"
        : customer.hasLead
          ? "En seguimiento"
          : customer.status;
    const risk = customer.hasOverdueInvoice
      ? "Alto"
      : customer.hasPendingWork
        ? "Medio"
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
      contactName: index === 0 ? "Responsable principal" : "Contacto operaciones",
      email: `contacto@${slugify(lead)}.demo`,
      phone: "+34 600 000 000",
      value: leadValue,
      tags: [stage.status, "Demo"],
      nextStep: "Seguimiento comercial",
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
        id: "decision-seed-cristales-nadia",
        serviceId: "srv-1004",
        serviceTitle: "Cristales y garaje",
        serviceFamily: "Cristales",
        customer: "Comunidad Torres Norte",
        city: "Getafe",
        recommendedEmployee: "Nadia Ramos",
        selectedEmployee: "Nadia Ramos",
        wasAcceptedByManager: true,
        decisionType: "manager-confirmed",
        resultLabel: "Servicio completado sin incidencias.",
        createdAt: "2026-06-10T12:00:00",
        reasons: [
          "Especialista en cristales.",
          "Buen encaje con comunidades.",
          "Disponibilidad confirmada por el responsable.",
        ],
      },
    ],
    activities: [
      {
        id: "activity-seed",
        title: "Demo local preparada",
        description: "Los datos se guardan en este navegador para poder enseñar la aplicación sin backend real.",
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
        notify("Nota vacía", "Escribe una nota antes de guardarla.");
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
      addActivity("Nota guardada", `${customer}: ${noteBody.slice(0, 80)}`);
      notify("Nota guardada", "La nota queda visible en la ficha del cliente.");
    },
    [addActivity, notify]
  );

  const createBookingRequest = React.useCallback(
    (input: DemoBookingInput) => {
      const customer = input.customer.trim() || "Nuevo cliente web";
      const contactName = input.contactName.trim() || "Contacto principal";
      const title = input.title.trim() || "Solicitud de limpieza";
      const city = input.city.trim() || "Madrid";
      const address = input.address.trim() || "Dirección pendiente";
      const preferredDate = input.preferredDate || addDays(5);
      const preferredTime = input.preferredTime || "10:00";
      const description =
        input.description.trim() || "Reserva creada desde el formulario público.";
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
        status: "Pendiente",
        recurrence: "Puntual",
        start: scheduledAt,
        team: ["Equipo por asignar"],
        city,
        price: estimatedPrice,
        vatRate: 21,
        address,
        assignmentMode: "Pendiente",
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
        recommendation.canAutoAssign && recommendation.employeeName !== "Equipo por asignar";
      const assignedTeam = canAutoAssign ? [recommendation.employeeName] : ["Equipo por asignar"];
      const suggestedTeam =
        recommendation.employeeName === "Equipo por asignar"
          ? ["Revisar disponibilidad"]
          : [recommendation.employeeName];
      const assignmentMode: DemoService["assignmentMode"] = canAutoAssign
        ? "Autoasignada"
        : "Recomendada";

      const request: DemoPortalRequest = {
        id: requestId,
        customer,
        title,
        preferredDate,
        description: `${address}. ${description}`,
        status: canAutoAssign ? "Autoasignado" : "Pendiente",
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
        status: "Nuevo",
        name: customer,
        companyName: customer,
        contactName,
        email: input.email.trim() || `contacto@${slugify(customer)}.demo`,
        phone: input.phone.trim() || "+34 600 000 000",
        value: estimatedPrice,
        tags: canAutoAssign
          ? ["Reserva web", "Autoasignada", city]
          : ["Reserva web", "Pendiente asignación", city],
        nextStep: canAutoAssign
          ? `Reserva autoasignada a ${recommendation.employeeName}. Revisar confirmación al cliente.`
          : `Revisar solicitud y asignar empleado. Recomendado: ${suggestedTeam.join(", ")}`,
        createdAt,
      };

      const service: DemoService = {
        ...serviceForRecommendation,
        status: canAutoAssign ? "Programado" : "Pendiente",
        team: assignedTeam,
        assignmentMode,
        assignmentRecommendation: recommendation,
      };

      const note: DemoNote = {
        id: createId("note"),
        customer,
        body: `Reserva web recibida: ${title}. Dirección: ${address}. Recomendación: ${recommendation.employeeName} (${recommendation.state}).`,
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
            resultLabel: "Autoasignación pendiente de resultado.",
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
      addActivity("Reserva web recibida", `${customer}: ${title}.`);
      if (canAutoAssign) {
        addActivity(
          "Autoasignación aplicada",
          `${recommendation.employeeName} queda asignada por aprendizaje operativo.`
        );
        notify("Reserva autoasignada", "Solicitud, lead y calendario actualizados con empleado asignado.");
      } else {
        addActivity(
          "Servicio pendiente de asignación",
          `${title} queda en calendario. Recomendado: ${recommendation.employeeName}.`
        );
        notify("Reserva recibida", "Solicitud, lead y calendario actualizados. Falta confirmar empleado.");
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
        "LimpiaPro CRM - Documento demo",
        `Numero: ${payload?.number ?? invoice?.number ?? "DOC-DEMO"}`,
        `Cliente: ${payload?.customer ?? invoice?.customer ?? "Atrium Labs"}`,
        `Estado: ${payload?.status ?? invoice?.status ?? "Pendiente"}`,
        `Base imponible: ${invoice?.subtotal ?? 1200} EUR`,
        `IVA 21%: ${invoice?.vat ?? 252} EUR`,
        `Total: ${invoice?.total ?? 1452} EUR`,
        "",
        "Este PDF se genera en local para la demo comercial.",
      ];
      downloadBlob(
        `${payload?.number ?? invoice?.number ?? "documento-demo"}.pdf`,
        createSimplePdf(lines),
        "application/pdf"
      );
      addActivity("PDF descargado", payload?.number ?? invoice?.number ?? "Documento demo");
      notify("PDF descargado", "Se ha generado un documento local de muestra.");
    },
    [addActivity, notify, state.invoices]
  );

  const convertQuoteToService = React.useCallback(
    (quoteId: string) => {
      const quote = state.quotes.find((item) => item.id === quoteId);
      if (!quote) return;

      const service: DemoService = {
        id: createId("srv"),
        title: `Servicio desde ${quote.number}`,
        customer: quote.customer,
        status: "Pendiente",
        recurrence: "Puntual",
        start: new Date(`${addDays(3)}T09:00:00`).toISOString(),
        team: ["Equipo por asignar"],
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
      addActivity("Presupuesto convertido", `${quote.number} se ha convertido en servicio.`);
      notify("Presupuesto convertido", "El nuevo servicio aparece en Servicios y Dashboard.");
    },
    [addActivity, notify, state.quotes]
  );

  const toggleAutomation = React.useCallback(
    (id: string, active: boolean) => {
      const nextStatus = active ? "Activo" : "Pausado";
      setState((current) => ({
        ...current,
        automations: current.automations.map((automation) =>
          automation.id === id ? { ...automation, status: nextStatus } : automation
        ),
      }));
      notify("Automatización actualizada", `Estado: ${nextStatus}.`);
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
                          status === "Completado"
                            ? "Servicio completado. Solicitar reseña y proponer recurrencia."
                            : lead.nextStep,
                      }
                    : lead
                )
              : current.leads,
        };
      });
      notify("Servicio actualizado", `Estado cambiado a ${status}.`);
    },
    [notify]
  );

  const updateLeadStatus = React.useCallback(
    (id: string, status: DemoLeadStatus) => {
      setState((current) => ({
        ...current,
        leads: current.leads.map((lead) => (lead.id === id ? { ...lead, status } : lead)),
      }));
      notify("Lead actualizado", `Estado cambiado a ${status}.`);
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
      notify("Empleado actualizado", `Estado cambiado a ${status}.`);
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
                          status === "Completado"
                            ? "Servicio completado. Pedir reseña y ofrecer mantenimiento."
                            : lead.nextStep,
                      }
                    : lead
                )
              : current.leads,
        };
      });
      notify("Solicitud actualizada", `Estado cambiado a ${status}.`);
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
      addActivity("Lead eliminado", `${lead?.companyName ?? "Lead"} retirado del pipeline.`);
      notify("Lead eliminado", "Ya no aparece en el CRM comercial.");
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
      addActivity("Servicio eliminado", `${service?.title ?? "Servicio"} retirado del calendario.`);
      notify("Servicio eliminado", "Se ha eliminado junto a su solicitud web asociada si existía.");
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
      addActivity("Reserva web eliminada", `${request?.customer ?? "Solicitud"} retirada de la demo.`);
      notify("Reserva web eliminada", "Se han quitado también calendario y lead asociados.");
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
            status: team.length === 0 ? "Pendiente" : service.status,
            team: team.length > 0 ? team : ["Equipo por asignar"],
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
            assignedTeam: assignedTeam?.length ? assignedTeam : ["Equipo por asignar"],
            suggestedTeam: suggestedTeam?.length ? suggestedTeam : request.suggestedTeam,
            status: assignedTeam?.length ? request.status : "Pendiente",
          };
        }),
      }));
      addActivity("Empleado eliminado", `${employeeName ?? "Empleado"} retirado del equipo.`);
      notify("Empleado eliminado", "Sus servicios quedan pendientes si se quedan sin equipo.");
    },
    [addActivity, notify, state.employees]
  );

  const clearDemoScope = React.useCallback(
    (scope: "web" | "services" | "leads" | "employees" | "notes") => {
      const initial = createInitialState();
      const scopeLabels = {
        employees: "empleados",
        leads: "leads",
        notes: "notas",
        services: "servicios",
        web: "reservas web",
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
                team: team.length > 0 ? team : ["Equipo por asignar"],
              };
            }),
          };
        }

        return {
          ...current,
          notes: [],
        };
      });

      addActivity("Datos de demo limpiados", `Bloque limpiado: ${scopeLabels[scope]}.`);
      notify("Datos limpiados", `Se ha limpiado el bloque de ${scopeLabels[scope]}.`);
    },
    [addActivity, notify]
  );

  const assignServiceTeam = React.useCallback(
    (serviceId: string, employeeName: string) => {
      const nextTeam = employeeName ? [employeeName] : ["Equipo por asignar"];
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
        recommendationBefore.employeeName !== "Equipo por asignar"
          ? recommendationBefore.employeeName
          : undefined;
      const acceptedRecommendation = Boolean(
        employeeName && recommendedEmployee && employeeName === recommendedEmployee
      );

      setState((current) => {
        const previousService = current.services.find((service) => service.id === serviceId);
        const nextStatus = employeeName ? "Programado" : "Pendiente";
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
          recommendation?.employeeName && recommendation.employeeName !== "Equipo por asignar"
            ? recommendation.employeeName
            : undefined;
        const assignmentMode: DemoService["assignmentMode"] = selectedEmployee
          ? selectedEmployee === currentRecommendedEmployee
            ? "Recomendada"
            : "Manual"
          : "Pendiente";
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
                resultLabel: "Pendiente de resultado operativo.",
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
                  status: service.status === "Completado" ? service.status : nextStatus,
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
                  status: employeeName ? "Programado" : "Pendiente",
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
              status: "Asignado",
              jobs: employee.jobs + 1,
              revenue: employee.revenue + Math.round((previousService?.price ?? 0) / nextTeam.length),
            };
          }),
        };
      });

      if (employeeName) {
        addActivity(
          acceptedRecommendation ? "Recomendación aceptada" : "Asignación manual guardada",
          `${employeeName} queda asignado al servicio.`
        );
        notify(
          acceptedRecommendation ? "Recomendación aceptada" : "Cambio guardado",
          acceptedRecommendation
            ? "El sistema lo guarda como aprendizaje para próximas reservas."
            : "La corrección queda guardada para ajustar futuras recomendaciones."
        );
      } else {
        notify("Asignación pendiente", "El servicio queda pendiente de equipo.");
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
      addActivity("Servicio reprogramado", `${service.title} movido al ${nextDate}.`);
      notify("Calendario actualizado", "Servicio, solicitud web y vistas operativas quedan sincronizados.");
    },
    [addActivity, notify, state.services]
  );

  const resetDemo = React.useCallback(() => {
    const initial = createInitialState();
    setState(initial);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    notify("Demo reiniciada", "Se han restaurado los datos iniciales.");
  }, [notify]);

  const runAction = React.useCallback(
    (action: DemoAction, payload?: Record<string, string>) => {
      switch (action) {
        case "export-dashboard": {
          const rows = [
            ["tipo", "nombre", "cliente", "estado", "total"],
            ...state.services.map((service) => [
              "servicio",
              service.title,
              service.customer,
              service.status,
              service.price,
            ]),
            ...state.invoices.map((invoice) => [
              "factura",
              invoice.number,
              invoice.customer,
              invoice.status,
              invoice.total,
            ]),
          ];
          downloadBlob(
            "limpiapro-export-demo.csv",
            rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
            "text/csv;charset=utf-8"
          );
          addActivity("Exportación generada", "CSV local con servicios y facturas.");
          notify("Exportación lista", "Se ha descargado un CSV con los datos de la demo.");
          break;
        }
        case "filters":
          notify("Filtros aplicados", "La vista queda preparada para segmentar por estado y etiqueta.");
          addActivity("Filtros revisados", "Vista comercial preparada para la demo.");
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
          notify("Portal de facturación abierto", "En demo local se simula la entrada al portal Stripe.");
          addActivity("Portal Stripe demo", "Gestión de suscripción simulada en local.");
          break;
        case "new-automation":
          openDialog("automation");
          break;
        case "request-service":
          openDialog("request");
          break;
        case "analytics":
          notify("Analítica generada", "MRR, churn y empresas están listos para comentar en la demo.");
          addActivity("Analítica consultada", "Panel SaaS revisado por super admin.");
          break;
        case "google-calendar":
          notify("Integración preparada", "La conexión con Google Calendar queda simulada para preproducción.");
          addActivity("Google Calendar demo", "Sincronización preparada para credenciales reales.");
          break;
        case "new-visit":
          openDialog("visit");
          break;
        case "settings":
          notify("Configuración abierta", "Ajustes de empresa simulados para la demo local.");
          addActivity("Configuración consultada", "Preferencias del workspace revisadas.");
          break;
        case "notifications":
          notify("Alertas operativas", "2 servicios críticos, 1 factura vencida y 1 pago fallido.");
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
        const companyName = textFrom(formData.get("companyName"), "Nuevo lead");
        const lead: DemoLead = {
          id: editingId ?? createId("lead"),
          status: textFrom(formData.get("status"), "Nuevo") as DemoLeadStatus,
          name: companyName,
          companyName,
          contactName: textFrom(formData.get("contactName"), "Contacto principal"),
          email: textFrom(formData.get("email"), `contacto@${slugify(companyName)}.demo`),
          phone: textFrom(formData.get("phone"), "+34 600 000 000"),
          value: numberFrom(formData.get("value"), 1800),
          tags: csvListFrom(textFrom(formData.get("tags"), "Demo")),
          nextStep: textFrom(formData.get("nextStep"), "Enviar presupuesto"),
          createdAt: existingLead?.createdAt ?? new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          leads: editingId
            ? current.leads.map((item) => (item.id === editingId ? lead : item))
            : [lead, ...current.leads],
        }));
        addActivity(
          editingId ? "Lead actualizado" : "Lead creado",
          `${lead.companyName} ${editingId ? "actualizado" : "añadido al pipeline"}.`
        );
        notify(
          editingId ? "Lead actualizado" : "Lead creado",
          editingId ? "Los cambios quedan guardados en el CRM." : "Aparece en el pipeline comercial."
        );
      }

      if (dialog.type === "service" || dialog.type === "visit") {
        const existingService = state.services.find((item) => item.id === editingId);
        const title = textFrom(
          formData.get("title"),
          dialog.type === "visit" ? "Nueva visita" : "Servicio de limpieza"
        );
        const customer = textFrom(
          formData.get("customer"),
          dialog.payload?.customer ?? "Atrium Labs"
        );
        const date = textFrom(formData.get("date"), datePart(existingService?.start));
        const time = textFrom(formData.get("time"), timePart(existingService?.start));
        const team = csvListFrom(textFrom(formData.get("team"), "Equipo por asignar"), [
          "Equipo por asignar",
        ]);
        const service: DemoService = {
          ...existingService,
          id: editingId ?? createId("srv"),
          title,
          customer,
          status: textFrom(formData.get("status"), "Programado"),
          recurrence: textFrom(formData.get("recurrence"), "Puntual"),
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
                          tags: ["Reserva web", service.city, service.status],
                          value: service.price,
                        }
                      : lead
                  )
                : current.leads,
          };
        });
        addActivity(
          editingId ? "Servicio actualizado" : "Servicio creado",
          `${service.title} para ${service.customer}.`
        );
        notify(
          editingId ? "Servicio actualizado" : "Servicio creado",
          editingId
            ? "Calendario, equipo y estado quedan sincronizados."
            : "Ya aparece en Servicios, Dashboard y Portal."
        );
      }

      if (dialog.type === "employee") {
        const existingEmployee = state.employees.find((item) => item.id === editingId);
        const previousName = existingEmployee?.name;
        const employee: DemoEmployee = {
          ...existingEmployee,
          id: editingId ?? createId("emp"),
          name: textFrom(formData.get("name"), "Nuevo empleado"),
          role: textFrom(formData.get("role"), "Operario/a"),
          status: textFrom(formData.get("status"), "Disponible"),
          availability: textFrom(formData.get("availability"), "L-V 08:00-16:00"),
          jobs: existingEmployee?.jobs ?? 0,
          score: existingEmployee?.score ?? 90,
          revenue: existingEmployee?.revenue ?? 0,
          notes: textFrom(formData.get("notes"), "Alta creada desde demo local."),
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
          editingId ? "Empleado actualizado" : "Empleado creado",
          `${employee.name} ${editingId ? "actualizado" : "añadido al equipo"}.`
        );
        notify(
          editingId ? "Empleado actualizado" : "Empleado creado",
          editingId ? "Sus asignaciones se mantienen actualizadas." : "Se añade al listado de campo."
        );
      }

      if (dialog.type === "quote") {
        const total = numberFrom(formData.get("total"), 1200);
        const quote: DemoQuote = {
          id: createId("quote"),
          number: `P-${new Date().getFullYear()}-${String(state.quotes.length + 49).padStart(4, "0")}`,
          customer: textFrom(formData.get("customer"), dialog.payload?.customer ?? "Atrium Labs"),
          status: "Borrador",
          total,
          validUntil: textFrom(formData.get("validUntil"), addDays(14)),
        };
        setState((current) => ({ ...current, quotes: [quote, ...current.quotes] }));
        addActivity("Presupuesto creado", `${quote.number} para ${quote.customer}.`);
        notify("Presupuesto creado", "Puedes convertirlo en servicio desde Facturación.");
      }

      if (dialog.type === "invoice") {
        const subtotal = numberFrom(formData.get("subtotal"), 1000);
        const vat = subtotal * 0.21;
        const invoice: DemoInvoice = {
          id: createId("inv"),
          number: `F-${new Date().getFullYear()}-${String(state.invoices.length + 143).padStart(4, "0")}`,
          customer: textFrom(formData.get("customer"), dialog.payload?.customer ?? "Atrium Labs"),
          status: textFrom(formData.get("status"), "Pendiente"),
          dueDate: textFrom(formData.get("dueDate"), addDays(7)),
          subtotal,
          vat,
          total: subtotal + vat,
        };
        setState((current) => ({ ...current, invoices: [invoice, ...current.invoices] }));
        addActivity("Factura creada", `${invoice.number} para ${invoice.customer}.`);
        notify("Factura creada", "La factura queda disponible para descargar en PDF.");
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
        const email = textFrom(formData.get("email"), "marta@atriumlabs.es");
        const phone = textFrom(formData.get("phone"), "+34 611 204 338");
        const title = textFrom(formData.get("title"), "Solicitud de limpieza");
        const city = textFrom(formData.get("city"), "Madrid");
        const address = textFrom(formData.get("address"), "Calle Serrano 42, Madrid");
        const preferredDate = textFrom(formData.get("preferredDate"), addDays(5));
        const preferredTime = textFrom(formData.get("preferredTime"), "10:00");
        const description = textFrom(
          formData.get("description"),
          "Solicitud creada desde portal cliente."
        );
        const estimatedPrice = numberFrom(formData.get("estimatedPrice"), 680);
        const status = textFrom(formData.get("status"), "Pendiente");
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
                          status === "Pendiente" || status === "Cancelado"
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
                          status === "Pendiente"
                            ? "Revisar solicitud web y confirmar equipo."
                            : lead.nextStep,
                        phone,
                        tags: ["Reserva web", city, status],
                        value: estimatedPrice,
                      }
                    : lead
                )
              : current.leads,
          }));
          addActivity("Reserva web actualizada", `${customer}: ${title}.`);
          notify("Reserva actualizada", "Solicitud, lead y calendario quedan sincronizados.");
        } else if (dialog.payload?.legacy === "true") {
          const request: DemoPortalRequest = {
            id: createId("request"),
            customer,
            title,
            preferredDate,
            description,
            status: "Pendiente",
            createdAt: new Date().toISOString(),
          };
          setState((current) => ({
            ...current,
            portalRequests: [request, ...current.portalRequests],
          }));
          addActivity("Solicitud recibida", `${customer}: ${title}.`);
          notify("Solicitud enviada", "Aparece en el portal como petición pendiente.");
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
          name: textFrom(formData.get("name"), "Nueva automatización"),
          trigger: textFrom(formData.get("trigger"), "FOLLOW_UP"),
          channel: textFrom(formData.get("channel"), "Email"),
          status: "Activo",
          sent: 0,
          conversion: "0 %",
        };
        setState((current) => ({
          ...current,
          automations: [automation, ...current.automations],
        }));
        addActivity("Automatización creada", `${automation.name} activada.`);
        notify("Automatización creada", "Puedes pausarla o activarla desde el panel.");
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
              Cancelar
            </Button>
            <Button type="submit">{editing ? "Actualizar" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const dialogTitles: Record<DemoDialogType, string> = {
  lead: "Nuevo lead",
  service: "Crear servicio",
  employee: "Nuevo empleado",
  quote: "Nuevo presupuesto",
  invoice: "Nueva factura",
  note: "Guardar nota",
  request: "Solicitar servicio",
  automation: "Nueva automatización",
  visit: "Nueva visita",
};

const dialogEditTitles: Partial<Record<DemoDialogType, string>> = {
  employee: "Editar empleado",
  lead: "Editar lead",
  request: "Editar reserva web",
  service: "Editar servicio",
  visit: "Editar visita",
};

const dialogDescriptions: Record<DemoDialogType, string> = {
  lead: "Crea una oportunidad comercial visible en el pipeline.",
  service: "Programa un servicio de limpieza con equipo, ciudad e importe.",
  employee: "Añade una persona al equipo de campo.",
  quote: "Genera un presupuesto con IVA preparado para convertir a servicio.",
  invoice: "Crea una factura descargable en PDF local.",
  note: "Registra una nota comercial u operativa en la ficha del cliente.",
  request: "Simula una petición desde el portal cliente.",
  automation: "Configura una regla automática de email, SMS o seguimiento.",
  visit: "Crea una visita operativa desde el calendario.",
};

function DialogFields({ dialog }: { dialog: DemoDialogState }) {
  if (dialog.type === "lead") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Empresa">
          <Input name="companyName" defaultValue={payloadText(dialog, "companyName", "Residencial Prado")} required />
        </FormField>
        <FormField label="Contacto">
          <Input name="contactName" defaultValue={payloadText(dialog, "contactName", "Ana Martín")} />
        </FormField>
        <FormField label="Email">
          <Input name="email" type="email" defaultValue={payloadText(dialog, "email", "ana@residencialprado.demo")} />
        </FormField>
        <FormField label="Teléfono">
          <Input name="phone" defaultValue={payloadText(dialog, "phone", "+34 622 140 900")} />
        </FormField>
        <FormField label="Estado">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "Nuevo")}
            options={["Nuevo", "Cualificado", "Presupuesto", "Ganado"]}
          />
        </FormField>
        <FormField label="Valor estimado">
          <Input name="value" type="number" defaultValue={payloadText(dialog, "value", "1850")} min="0" />
        </FormField>
        <FormField label="Etiquetas">
          <Input name="tags" defaultValue={payloadText(dialog, "tags", "Madrid, Comunidad")} />
        </FormField>
        <FormField label="Siguiente paso">
          <Input name="nextStep" defaultValue={payloadText(dialog, "nextStep", "Enviar propuesta esta semana")} />
        </FormField>
      </div>
    );
  }

  if (dialog.type === "service" || dialog.type === "visit") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Servicio">
          <Input
            name="title"
            defaultValue={payloadText(
              dialog,
              "title",
              dialog.type === "visit" ? "Visita de supervisión" : "Limpieza recurrente"
            )}
            required
          />
        </FormField>
        <FormField label="Cliente">
          <Input name="customer" defaultValue={dialog.payload?.customer ?? "Atrium Labs"} />
        </FormField>
        <FormField label="Ciudad">
          <Input name="city" defaultValue={payloadText(dialog, "city", "Madrid")} />
        </FormField>
        <FormField label="Estado">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "Programado")}
            options={["Pendiente", "Programado", "En curso", "Completado", "Cancelado"]}
          />
        </FormField>
        <FormField label="Fecha">
          <Input name="date" type="date" defaultValue={payloadText(dialog, "date", addDays(1))} />
        </FormField>
        <FormField label="Hora">
          <Input name="time" type="time" defaultValue={payloadText(dialog, "time", "09:00")} />
        </FormField>
        <FormField label="Recurrencia">
          <DemoNativeSelect
            name="recurrence"
            defaultValue={payloadText(dialog, "recurrence", dialog.type === "visit" ? "Puntual" : "Semanal")}
            options={["Puntual", "Diario", "Semanal", "Mensual"]}
          />
        </FormField>
        <FormField label="Importe sin IVA">
          <Input name="price" type="number" defaultValue={payloadText(dialog, "price", "650")} min="0" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Equipo">
            <Input name="team" defaultValue={payloadText(dialog, "team", "Laura Méndez, Nadia Ramos")} />
          </FormField>
        </div>
      </div>
    );
  }

  if (dialog.type === "employee") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nombre">
          <Input name="name" defaultValue={payloadText(dialog, "name", "Sara Molina")} required />
        </FormField>
        <FormField label="Rol">
          <Input name="role" defaultValue={payloadText(dialog, "role", "Operaria especialista")} />
        </FormField>
        <FormField label="Estado">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "Disponible")}
            options={["Disponible", "Asignado", "Vacaciones", "Baja"]}
          />
        </FormField>
        <FormField label="Disponibilidad">
          <Input name="availability" defaultValue={payloadText(dialog, "availability", "L-V 08:00-16:00")} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Notas internas">
            <Input name="notes" defaultValue={payloadText(dialog, "notes", "Alta para refuerzos de oficinas premium.")} />
          </FormField>
        </div>
      </div>
    );
  }

  if (dialog.type === "quote") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Cliente">
          <Input name="customer" defaultValue={dialog.payload?.customer ?? "Clínica Alameda"} />
        </FormField>
        <FormField label="Total con IVA">
          <Input name="total" type="number" defaultValue="1452" min="0" />
        </FormField>
        <FormField label="Válido hasta">
          <Input name="validUntil" type="date" defaultValue={addDays(14)} />
        </FormField>
      </div>
    );
  }

  if (dialog.type === "invoice") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Cliente">
          <Input name="customer" defaultValue={dialog.payload?.customer ?? "Atrium Labs"} />
        </FormField>
        <FormField label="Base imponible">
          <Input name="subtotal" type="number" defaultValue="1200" min="0" />
        </FormField>
        <FormField label="Estado">
          <DemoNativeSelect
            name="status"
            defaultValue="Pendiente"
            options={["Pendiente", "Pagada", "Vencida"]}
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
        <FormField label="Nota">
          <Textarea name="body" className="min-h-32" placeholder="Escribe una nota para el equipo..." />
        </FormField>
      </div>
    );
  }

  if (dialog.type === "request") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Cliente">
          <Input name="customer" defaultValue={payloadText(dialog, "customer", "Atrium Labs")} />
        </FormField>
        <FormField label="Contacto">
          <Input name="contactName" defaultValue={payloadText(dialog, "contactName", "Marta Soler")} />
        </FormField>
        <FormField label="Email">
          <Input name="email" type="email" defaultValue={payloadText(dialog, "email", "marta@atriumlabs.es")} />
        </FormField>
        <FormField label="Teléfono">
          <Input name="phone" defaultValue={payloadText(dialog, "phone", "+34 611 204 338")} />
        </FormField>
        <FormField label="Servicio solicitado">
          <Input name="title" defaultValue={payloadText(dialog, "title", "Limpieza extra de cristales")} />
        </FormField>
        <FormField label="Ciudad">
          <Input name="city" defaultValue={payloadText(dialog, "city", "Madrid")} />
        </FormField>
        <FormField label="Dirección">
          <Input name="address" defaultValue={payloadText(dialog, "address", "Calle Serrano 42, Madrid")} />
        </FormField>
        <FormField label="Estado">
          <DemoNativeSelect
            name="status"
            defaultValue={payloadText(dialog, "status", "Pendiente")}
            options={["Pendiente", "Programado", "Autoasignado", "Completado", "Cancelado"]}
          />
        </FormField>
        <FormField label="Fecha preferida">
          <Input name="preferredDate" type="date" defaultValue={payloadText(dialog, "preferredDate", addDays(5))} />
        </FormField>
        <FormField label="Hora preferida">
          <Input name="preferredTime" type="time" defaultValue={payloadText(dialog, "preferredTime", "10:00")} />
        </FormField>
        <FormField label="Importe estimado">
          <Input name="estimatedPrice" type="number" defaultValue={payloadText(dialog, "estimatedPrice", "680")} min="0" />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Descripción">
            <Textarea
              name="description"
              defaultValue={payloadText(
                dialog,
                "description",
                "Necesitamos una visita extra antes de la reunión mensual."
              )}
            />
          </FormField>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Nombre">
        <Input name="name" defaultValue="Follow-up de oportunidad" required />
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
