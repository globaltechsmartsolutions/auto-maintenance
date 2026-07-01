export type DemoAssignmentState =
  | "Lista para autoasignar"
  | "Recomendación alta"
  | "Revisar antes de asignar"
  | "No recomendable";

export type DemoAssignmentEmployeeInput = {
  id: string;
  name: string;
  role?: string;
  status: string;
  availability: string;
  jobs: number;
  score: number;
  revenue?: number;
  notes?: string;
  skills?: string[];
  zones?: string[];
  preferredServiceTypes?: string[];
  customerAffinity?: string[];
  maxJobsPerDay?: number;
  maxHoursPerDay?: number;
  incidentRate?: number;
};

export type DemoAssignmentServiceInput = {
  id: string;
  title: string;
  customer: string;
  status: string;
  recurrence?: string;
  start: string;
  team: string[];
  city: string;
  price?: number;
  vatRate?: number;
  address?: string;
  description?: string;
  requiredSkills?: string[];
  estimatedDurationMinutes?: number;
};

export type DemoAssignmentDecision = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  serviceFamily: string;
  customer: string;
  city: string;
  recommendedEmployee?: string;
  selectedEmployee: string;
  wasAcceptedByManager: boolean;
  decisionType: "manager-confirmed" | "manager-override" | "auto-assigned";
  resultLabel: string;
  createdAt: string;
  reasons: string[];
};

export type DemoAssignmentAlternative = {
  employeeName: string;
  reason: string;
  state: DemoAssignmentState;
};

export type DemoAssignmentRecommendation = {
  employeeName: string;
  state: DemoAssignmentState;
  summary: string;
  serviceFamily: string;
  requiredSkills: string[];
  estimatedDurationMinutes: number;
  reasons: string[];
  learningSignals: string[];
  warnings: string[];
  alternatives: DemoAssignmentAlternative[];
  rejected: Array<{
    employeeName: string;
    reason: string;
  }>;
  canAutoAssign: boolean;
  internalScore: number;
};

type ServiceProfile = {
  family: string;
  customerType: string;
  requiredSkills: string[];
  estimatedDurationMinutes: number;
  sensitive: boolean;
};

type EmployeeProfile = {
  skills: string[];
  zones: string[];
  preferredServiceTypes: string[];
  customerAffinity: string[];
  maxJobsPerDay: number;
  maxHoursPerDay: number;
  incidentRate: number;
};

type Candidate = {
  employee: DemoAssignmentEmployeeInput;
  profile: EmployeeProfile;
  score: number;
  reasons: string[];
  learningSignals: string[];
  warnings: string[];
  rejectedReason?: string;
  acceptedSimilar: number;
};

const GENERIC_EMPLOYEE_PROFILE: EmployeeProfile = {
  skills: ["mantenimiento", "oficinas"],
  zones: ["madrid"],
  preferredServiceTypes: ["mantenimiento general"],
  customerAffinity: [],
  maxJobsPerDay: 4,
  maxHoursPerDay: 8,
  incidentRate: 0.03,
};

const EMPLOYEE_PROFILES: Record<string, EmployeeProfile> = {
  "laura mendez": {
    skills: ["oficinas", "premium", "comunidades", "coordinacion"],
    zones: ["madrid", "madrid centro", "salamanca", "retiro"],
    preferredServiceTypes: ["oficinas", "comunidades"],
    customerAffinity: ["atrium labs", "residencial prado"],
    maxJobsPerDay: 5,
    maxHoursPerDay: 8,
    incidentRate: 0.01,
  },
  "miguel prieto": {
    skills: ["sanitario", "desinfeccion", "oficinas"],
    zones: ["madrid", "barcelona"],
    preferredServiceTypes: ["sanitario", "desinfeccion"],
    customerAffinity: ["clinica alameda"],
    maxJobsPerDay: 4,
    maxHoursPerDay: 8,
    incidentRate: 0.02,
  },
  "nadia ramos": {
    skills: ["cristales", "garajes", "comunidades", "mantenimiento"],
    zones: ["madrid", "madrid centro", "getafe", "salamanca", "retiro"],
    preferredServiceTypes: ["cristales", "garajes", "comunidades"],
    customerAffinity: ["comunidad torres norte", "residencial prado"],
    maxJobsPerDay: 4,
    maxHoursPerDay: 8,
    incidentRate: 0.015,
  },
  "hugo vega": {
    skills: ["cristales", "altura", "garajes"],
    zones: ["madrid", "madrid centro", "getafe"],
    preferredServiceTypes: ["cristales", "garajes"],
    customerAffinity: ["comunidad torres norte"],
    maxJobsPerDay: 4,
    maxHoursPerDay: 8,
    incidentRate: 0.025,
  },
  "irene costa": {
    skills: ["hoteles", "oficinas", "zonas comunes"],
    zones: ["alicante", "valencia"],
    preferredServiceTypes: ["hoteles", "zonas comunes"],
    customerAffinity: ["hotel bruma"],
    maxJobsPerDay: 5,
    maxHoursPerDay: 8,
    incidentRate: 0.018,
  },
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

export function getServiceProfile(service: Pick<
  DemoAssignmentServiceInput,
  "customer" | "description" | "estimatedDurationMinutes" | "requiredSkills" | "title"
>): ServiceProfile {
  const text = normalize(`${service.title} ${service.customer} ${service.description ?? ""}`);

  if (includesAny(text, ["desinfeccion", "sanitario", "clinica", "hospital"])) {
    return {
      family: "Sanitario",
      customerType: "Sanitario",
      requiredSkills: service.requiredSkills ?? ["sanitario", "desinfeccion"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 150,
      sensitive: true,
    };
  }

  if (includesAny(text, ["cristal", "cristales", "ventana", "escaparate"])) {
    return {
      family: "Cristales",
      customerType: includesAny(text, ["comunidad", "residencial"]) ? "Comunidad" : "General",
      requiredSkills: service.requiredSkills ?? ["cristales"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 150,
      sensitive: false,
    };
  }

  if (includesAny(text, ["garaje", "parking"])) {
    return {
      family: "Garajes",
      customerType: "Comunidad",
      requiredSkills: service.requiredSkills ?? ["garajes"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 150,
      sensitive: false,
    };
  }

  if (includesAny(text, ["oficina", "cowork", "despacho", "laboratorio"])) {
    return {
      family: "Oficinas",
      customerType: "Empresa",
      requiredSkills: service.requiredSkills ?? ["oficinas"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 180,
      sensitive: false,
    };
  }

  if (includesAny(text, ["obra", "reforma", "final de obra"])) {
    return {
      family: "Fin de obra",
      customerType: "Proyecto",
      requiredSkills: service.requiredSkills ?? ["fin de obra", "mantenimiento"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 240,
      sensitive: false,
    };
  }

  if (includesAny(text, ["hotel", "habitacion", "zonas comunes"])) {
    return {
      family: "Hoteles",
      customerType: "Hotel",
      requiredSkills: service.requiredSkills ?? ["hoteles", "zonas comunes"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 180,
      sensitive: false,
    };
  }

  return {
    family: "Mantenimiento general",
    customerType: "General",
    requiredSkills: service.requiredSkills ?? ["mantenimiento"],
    estimatedDurationMinutes: service.estimatedDurationMinutes ?? 120,
    sensitive: false,
  };
}

function getEmployeeProfile(employee: DemoAssignmentEmployeeInput): EmployeeProfile {
  const profile = EMPLOYEE_PROFILES[normalize(employee.name)] ?? GENERIC_EMPLOYEE_PROFILE;

  return {
    ...profile,
    skills: employee.skills ?? profile.skills,
    zones: employee.zones ?? profile.zones,
    preferredServiceTypes: employee.preferredServiceTypes ?? profile.preferredServiceTypes,
    customerAffinity: employee.customerAffinity ?? profile.customerAffinity,
    maxJobsPerDay: employee.maxJobsPerDay ?? profile.maxJobsPerDay,
    maxHoursPerDay: employee.maxHoursPerDay ?? profile.maxHoursPerDay,
    incidentRate: employee.incidentRate ?? profile.incidentRate,
  };
}

function getDayKey(value: string) {
  return value.slice(0, 10);
}

function minutesFromStartOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseAvailabilityWindow(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  return {
    start: Number(match[1]) * 60 + Number(match[2]),
    end: Number(match[3]) * 60 + Number(match[4]),
  };
}

function worksOnDate(employee: DemoAssignmentEmployeeInput, serviceDate: Date) {
  const availability = normalize(employee.availability);
  const day = serviceDate.getDay();
  const isSunday = day === 0;
  const isSaturday = day === 6;

  if (availability.includes("vuelve") || availability.includes("vacaciones")) {
    return false;
  }

  if (availability.includes("l-s")) {
    return !isSunday;
  }

  if (availability.includes("l-v")) {
    return !isSaturday && !isSunday;
  }

  return true;
}

function intervalOverlaps(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function hasTimeConflict(
  employeeName: string,
  service: DemoAssignmentServiceInput,
  services: DemoAssignmentServiceInput[],
  durationMinutes: number
) {
  const serviceDate = new Date(service.start);
  const start = serviceDate.getTime();
  const end = start + durationMinutes * 60_000;

  return services.some((item) => {
    if (item.id === service.id || item.status === "Cancelado") return false;
    if (!item.team.includes(employeeName)) return false;

    const otherProfile = getServiceProfile(item);
    const otherStart = new Date(item.start).getTime();
    const otherEnd = otherStart + (otherProfile.estimatedDurationMinutes + 30) * 60_000;

    return intervalOverlaps(start, end + 30 * 60_000, otherStart, otherEnd);
  });
}

function countDailyServices(
  employeeName: string,
  service: DemoAssignmentServiceInput,
  services: DemoAssignmentServiceInput[]
) {
  const dayKey = getDayKey(service.start);

  return services.filter(
    (item) =>
      item.id !== service.id &&
      item.status !== "Cancelado" &&
      getDayKey(item.start) === dayKey &&
      item.team.includes(employeeName)
  ).length;
}

function skillMatchScore(profile: EmployeeProfile, serviceProfile: ServiceProfile) {
  const employeeSkills = profile.skills.map(normalize);
  const requiredSkills = serviceProfile.requiredSkills.map(normalize);
  const matched = requiredSkills.filter((skill) => employeeSkills.includes(skill));

  if (matched.length === requiredSkills.length) {
    return { points: 28, exact: true };
  }

  if (
    requiredSkills.some((skill) =>
      profile.preferredServiceTypes.map(normalize).includes(skill)
    )
  ) {
    return { points: 18, exact: false };
  }

  if (employeeSkills.includes("mantenimiento") || employeeSkills.includes("coordinacion")) {
    return { points: 10, exact: false };
  }

  return { points: 0, exact: false };
}

function matchesZone(profile: EmployeeProfile, service: DemoAssignmentServiceInput) {
  const serviceZone = normalize(`${service.city} ${service.address ?? ""}`);

  return profile.zones
    .map(normalize)
    .some((zone) => serviceZone.includes(zone) || zone.includes(normalize(service.city)));
}

function getLearningStats(
  employeeName: string,
  service: DemoAssignmentServiceInput,
  serviceProfile: ServiceProfile,
  services: DemoAssignmentServiceInput[],
  decisions: DemoAssignmentDecision[]
) {
  const normalizedEmployee = normalize(employeeName);
  const normalizedCustomer = normalize(service.customer);
  const similarDecisions = decisions.filter(
    (decision) =>
      normalize(decision.serviceFamily) === normalize(serviceProfile.family) ||
      normalize(decision.customer) === normalizedCustomer
  );
  const acceptedSimilar = similarDecisions.filter(
    (decision) =>
      normalize(decision.recommendedEmployee ?? "") === normalizedEmployee &&
      normalize(decision.selectedEmployee) === normalizedEmployee
  ).length;
  const selectedSimilar = similarDecisions.filter(
    (decision) => normalize(decision.selectedEmployee) === normalizedEmployee
  ).length;
  const managerOverridesToEmployee = similarDecisions.filter(
    (decision) =>
      normalize(decision.selectedEmployee) === normalizedEmployee &&
      normalize(decision.recommendedEmployee ?? "") !== normalizedEmployee
  ).length;
  const managerOverridesAway = similarDecisions.filter(
    (decision) =>
      normalize(decision.recommendedEmployee ?? "") === normalizedEmployee &&
      normalize(decision.selectedEmployee) !== normalizedEmployee
  ).length;
  const similarCompletedServices = services.filter(
    (item) =>
      item.id !== service.id &&
      item.status !== "Cancelado" &&
      item.team.some((member) => normalize(member) === normalizedEmployee) &&
      normalize(getServiceProfile(item).family) === normalize(serviceProfile.family)
  ).length;
  const customerHistory = services.filter(
    (item) =>
      item.id !== service.id &&
      normalize(item.customer) === normalizedCustomer &&
      item.team.some((member) => normalize(member) === normalizedEmployee)
  ).length;

  return {
    acceptedSimilar,
    customerHistory,
    managerOverridesAway,
    managerOverridesToEmployee,
    selectedSimilar,
    similarCompletedServices,
  };
}

function buildCandidate(
  employee: DemoAssignmentEmployeeInput,
  service: DemoAssignmentServiceInput,
  serviceProfile: ServiceProfile,
  services: DemoAssignmentServiceInput[],
  decisions: DemoAssignmentDecision[]
): Candidate {
  const profile = getEmployeeProfile(employee);
  const serviceDate = new Date(service.start);
  const serviceMinutes = minutesFromStartOfDay(serviceDate);
  const availabilityWindow = parseAvailabilityWindow(employee.availability);
  const dailyLoad = countDailyServices(employee.name, service, services);
  const reasons: string[] = [];
  const learningSignals: string[] = [];
  const warnings: string[] = [];

  if (normalize(employee.status).includes("vacaciones")) {
    return {
      employee,
      profile,
      score: 0,
      reasons,
      learningSignals,
      warnings,
      rejectedReason: "está de vacaciones",
      acceptedSimilar: 0,
    };
  }

  if (!worksOnDate(employee, serviceDate)) {
    return {
      employee,
      profile,
      score: 0,
      reasons,
      learningSignals,
      warnings,
      rejectedReason: "no trabaja en esa fecha",
      acceptedSimilar: 0,
    };
  }

  if (
    availabilityWindow &&
    (serviceMinutes < availabilityWindow.start ||
      serviceMinutes + serviceProfile.estimatedDurationMinutes > availabilityWindow.end + 30)
  ) {
    return {
      employee,
      profile,
      score: 0,
      reasons,
      learningSignals,
      warnings,
      rejectedReason: "la franja solicitada queda fuera de su horario habitual",
      acceptedSimilar: 0,
    };
  }

  if (hasTimeConflict(employee.name, service, services, serviceProfile.estimatedDurationMinutes)) {
    return {
      employee,
      profile,
      score: 0,
      reasons,
      learningSignals,
      warnings,
      rejectedReason: "ya tiene otro servicio en una franja cercana",
      acceptedSimilar: 0,
    };
  }

  if (dailyLoad >= profile.maxJobsPerDay) {
    return {
      employee,
      profile,
      score: 0,
      reasons,
      learningSignals,
      warnings,
      rejectedReason: "ya tiene la carga máxima para ese día",
      acceptedSimilar: 0,
    };
  }

  let score = 0;
  const skillScore = skillMatchScore(profile, serviceProfile);
  score += skillScore.points;

  if (skillScore.exact) {
    reasons.push(`Tiene la especialidad adecuada para ${serviceProfile.family.toLowerCase()}.`);
  } else {
    warnings.push("Puede cubrir el servicio, pero no es la persona más especializada.");
  }

  score += 18;
  reasons.push("Tiene disponibilidad en la franja solicitada.");

  if (matchesZone(profile, service)) {
    score += 14;
    reasons.push(`Trabaja habitualmente en ${service.city}.`);
  } else {
    score += 4;
    warnings.push("La zona no es su área habitual.");
  }

  const freeSlots = profile.maxJobsPerDay - dailyLoad;
  if (freeSlots >= 3) {
    score += 14;
    reasons.push("Tiene carga baja ese día.");
  } else if (freeSlots >= 1) {
    score += 8;
    reasons.push("Todavía tiene margen en la agenda.");
  }

  if (employee.score >= 95) {
    score += 10;
    reasons.push("Tiene rendimiento excelente en el equipo.");
  } else if (employee.score >= 90) {
    score += 8;
    reasons.push("Tiene buen rendimiento operativo.");
  } else {
    score += 5;
  }

  if (profile.customerAffinity.map(normalize).includes(normalize(service.customer))) {
    score += 8;
    reasons.push("Ya encaja con este cliente o tipo de cuenta.");
  }

  const learning = getLearningStats(employee.name, service, serviceProfile, services, decisions);
  score += Math.min(learning.similarCompletedServices * 4, 12);
  score += Math.min(learning.selectedSimilar * 5, 15);
  score += Math.min(learning.managerOverridesToEmployee * 6, 12);
  score -= Math.min(learning.managerOverridesAway * 8, 16);

  if (learning.similarCompletedServices > 0) {
    learningSignals.push("Ya ha realizado servicios similares dentro de la empresa.");
  }

  if (learning.customerHistory > 0) {
    learningSignals.push("Tiene historial previo con este cliente.");
  }

  if (learning.acceptedSimilar > 0) {
    learningSignals.push("El responsable ya aceptó recomendaciones similares para esta persona.");
  }

  if (learning.managerOverridesToEmployee > 0) {
    learningSignals.push("El sistema ha aprendido correcciones previas hacia esta persona.");
  }

  if (learning.managerOverridesAway > 0) {
    warnings.push("En casos parecidos el responsable eligió a otra persona.");
  }

  if (profile.incidentRate <= 0.02) {
    score += 5;
    reasons.push("No arrastra incidencias recientes relevantes.");
  } else if (profile.incidentRate > 0.04) {
    score -= 6;
    warnings.push("Conviene revisar incidencias antes de asignar.");
  }

  return {
    employee,
    profile,
    score,
    reasons,
    learningSignals,
    warnings,
    acceptedSimilar: learning.acceptedSimilar,
  };
}

function stateFromCandidate(candidate: Candidate, serviceProfile: ServiceProfile): DemoAssignmentState {
  if (candidate.rejectedReason) {
    return "No recomendable";
  }

  const hasLearningForAutoAssign = candidate.acceptedSimilar >= 2;
  const hasWarnings = candidate.warnings.length > 0;

  if (candidate.score >= 82 && hasLearningForAutoAssign && !hasWarnings && !serviceProfile.sensitive) {
    return "Lista para autoasignar";
  }

  if (candidate.score >= 68) {
    return "Recomendación alta";
  }

  return "Revisar antes de asignar";
}

export function recommendAssignee({
  decisions,
  employees,
  service,
  services,
}: {
  decisions: DemoAssignmentDecision[];
  employees: DemoAssignmentEmployeeInput[];
  service: DemoAssignmentServiceInput;
  services: DemoAssignmentServiceInput[];
}): DemoAssignmentRecommendation {
  const serviceProfile = getServiceProfile(service);
  const candidates = employees.map((employee) =>
    buildCandidate(employee, service, serviceProfile, services, decisions)
  );
  const validCandidates = candidates
    .filter((candidate) => !candidate.rejectedReason)
    .sort((first, second) => second.score - first.score);
  const rejected = candidates
    .filter((candidate) => candidate.rejectedReason)
    .map((candidate) => ({
      employeeName: candidate.employee.name,
      reason: candidate.rejectedReason ?? "no recomendable",
    }));

  if (validCandidates.length === 0) {
    return {
      employeeName: "Equipo por asignar",
      state: "Revisar antes de asignar",
      summary: "No hay una persona claramente disponible. Revisa la agenda antes de confirmar.",
      serviceFamily: serviceProfile.family,
      requiredSkills: serviceProfile.requiredSkills,
      estimatedDurationMinutes: serviceProfile.estimatedDurationMinutes,
      reasons: ["La solicitud queda pendiente para revisión manual."],
      learningSignals: [],
      warnings: rejected.slice(0, 3).map((item) => `${item.employeeName}: ${item.reason}.`),
      alternatives: [],
      rejected,
      canAutoAssign: false,
      internalScore: 0,
    };
  }

  const best = validCandidates[0];
  const state = stateFromCandidate(best, serviceProfile);
  const alternatives = validCandidates.slice(1, 3).map((candidate) => ({
    employeeName: candidate.employee.name,
    reason:
      candidate.reasons[0] ??
      candidate.learningSignals[0] ??
      "Puede cubrir el servicio si el responsable lo prefiere.",
    state: stateFromCandidate(candidate, serviceProfile),
  }));

  return {
    employeeName: best.employee.name,
    state,
    summary: `${best.employee.name} es la mejor opción por encaje operativo, agenda y señales aprendidas.`,
    serviceFamily: serviceProfile.family,
    requiredSkills: serviceProfile.requiredSkills,
    estimatedDurationMinutes: serviceProfile.estimatedDurationMinutes,
    reasons: best.reasons.slice(0, 4),
    learningSignals: best.learningSignals.slice(0, 3),
    warnings: best.warnings.slice(0, 3),
    alternatives,
    rejected,
    canAutoAssign: state === "Lista para autoasignar",
    internalScore: Math.round(best.score),
  };
}
