export type DemoAssignmentState =
  | "Ready for auto-assignment"
  | "High recommendation"
  | "Review before assignment"
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
  skills: ["maintenance", "offices"],
  zones: ["madrid"],
  preferredServiceTypes: ["maintenance general"],
  customerAffinity: [],
  maxJobsPerDay: 4,
  maxHoursPerDay: 8,
  incidentRate: 0.03,
};

const EMPLOYEE_PROFILES: Record<string, EmployeeProfile> = {
  "laura mendez": {
    skills: ["offices", "premium", "communities", "coordination"],
    zones: ["madrid", "madrid centre", "salamanca", "retiro"],
    preferredServiceTypes: ["offices", "communities"],
    customerAffinity: ["atrium labs", "residential prado"],
    maxJobsPerDay: 5,
    maxHoursPerDay: 8,
    incidentRate: 0.01,
  },
  "miguel prieto": {
    skills: ["healthcare", "disinfection", "offices"],
    zones: ["madrid", "barcelona"],
    preferredServiceTypes: ["healthcare", "disinfection"],
    customerAffinity: ["clinica alameda"],
    maxJobsPerDay: 4,
    maxHoursPerDay: 8,
    incidentRate: 0.02,
  },
  "nadia ramos": {
    skills: ["windows", "garages", "communities", "maintenance"],
    zones: ["madrid", "madrid centre", "getafe", "salamanca", "retiro"],
    preferredServiceTypes: ["windows", "garages", "communities"],
    customerAffinity: ["community torres norte", "residential prado"],
    maxJobsPerDay: 4,
    maxHoursPerDay: 8,
    incidentRate: 0.015,
  },
  "hugo vega": {
    skills: ["windows", "high-rise", "garages"],
    zones: ["madrid", "madrid centre", "getafe"],
    preferredServiceTypes: ["windows", "garages"],
    customerAffinity: ["community torres norte"],
    maxJobsPerDay: 4,
    maxHoursPerDay: 8,
    incidentRate: 0.025,
  },
  "irene costa": {
    skills: ["hotels", "offices", "common areas"],
    zones: ["alicante", "valencia"],
    preferredServiceTypes: ["hotels", "common areas"],
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

  if (includesAny(text, ["disinfection", "healthcare", "clinica", "hospital"])) {
    return {
      family: "Healthcare",
      customerType: "Healthcare",
      requiredSkills: service.requiredSkills ?? ["healthcare", "disinfection"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 150,
      sensitive: true,
    };
  }

  if (includesAny(text, ["window", "windows", "window", "storefront"])) {
    return {
      family: "Windows",
      customerType: includesAny(text, ["community", "residential"]) ? "Community" : "General",
      requiredSkills: service.requiredSkills ?? ["windows"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 150,
      sensitive: false,
    };
  }

  if (includesAny(text, ["garage", "parking"])) {
    return {
      family: "Garajes",
      customerType: "Community",
      requiredSkills: service.requiredSkills ?? ["garages"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 150,
      sensitive: false,
    };
  }

  if (includesAny(text, ["office", "coworking", "workspace", "laboratory"])) {
    return {
      family: "Offices",
      customerType: "Company",
      requiredSkills: service.requiredSkills ?? ["offices"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 180,
      sensitive: false,
    };
  }

  if (includesAny(text, ["construction", "renovation", "post-construction"])) {
    return {
      family: "Post-construction",
      customerType: "Proyecto",
      requiredSkills: service.requiredSkills ?? ["post-construction", "maintenance"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 240,
      sensitive: false,
    };
  }

  if (includesAny(text, ["hotel", "room", "common areas"])) {
    return {
      family: "Hotels",
      customerType: "Hotel",
      requiredSkills: service.requiredSkills ?? ["hotels", "common areas"],
      estimatedDurationMinutes: service.estimatedDurationMinutes ?? 180,
      sensitive: false,
    };
  }

  return {
    family: "General maintenance",
    customerType: "General",
    requiredSkills: service.requiredSkills ?? ["maintenance"],
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

  if (availability.includes("returns") || availability.includes("on leave")) {
    return false;
  }

  if (availability.includes("mon-sat")) {
    return !isSunday;
  }

  if (availability.includes("mon-fri")) {
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
    if (item.id === service.id || item.status === "Cancelled") return false;
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
      item.status !== "Cancelled" &&
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

  if (employeeSkills.includes("maintenance") || employeeSkills.includes("coordination")) {
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
      item.status !== "Cancelled" &&
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

  if (normalize(employee.status).includes("holiday")) {
    return {
      employee,
      profile,
      score: 0,
      reasons,
      learningSignals,
      warnings,
      rejectedReason: "is on holiday",
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
      rejectedReason: "does not work on that date",
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
      rejectedReason: "the requested time slot is outside the usual schedule",
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
      rejectedReason: "already has another service in a nearby time slot",
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
      rejectedReason: "has reached the maximum workload for that day",
      acceptedSimilar: 0,
    };
  }

  let score = 0;
  const skillScore = skillMatchScore(profile, serviceProfile);
  score += skillScore.points;

  if (skillScore.exact) {
    reasons.push(`Has the right specialisation for ${serviceProfile.family.toLowerCase()}.`);
  } else {
    warnings.push("Can cover the service but is not the most specialised person.");
  }

  score += 18;
  reasons.push("Is available in the requested time slot.");

  if (matchesZone(profile, service)) {
    score += 14;
    reasons.push(`Usually works in ${service.city}.`);
  } else {
    score += 4;
    warnings.push("The area is outside their usual zone.");
  }

  const freeSlots = profile.maxJobsPerDay - dailyLoad;
  if (freeSlots >= 3) {
    score += 14;
    reasons.push("Has a low workload that day.");
  } else if (freeSlots >= 1) {
    score += 8;
    reasons.push("Still has capacity in the schedule.");
  }

  if (employee.score >= 95) {
    score += 10;
    reasons.push("Has excellent team performance.");
  } else if (employee.score >= 90) {
    score += 8;
    reasons.push("Has good operational performance.");
  } else {
    score += 5;
  }

  if (profile.customerAffinity.map(normalize).includes(normalize(service.customer))) {
    score += 8;
    reasons.push("Already fits this customer or account type.");
  }

  const learning = getLearningStats(employee.name, service, serviceProfile, services, decisions);
  score += Math.min(learning.similarCompletedServices * 4, 12);
  score += Math.min(learning.selectedSimilar * 5, 15);
  score += Math.min(learning.managerOverridesToEmployee * 6, 12);
  score -= Math.min(learning.managerOverridesAway * 8, 16);

  if (learning.similarCompletedServices > 0) {
    learningSignals.push("Has delivered similar services within the company.");
  }

  if (learning.customerHistory > 0) {
    learningSignals.push("Has previous history with this customer.");
  }

  if (learning.acceptedSimilar > 0) {
    learningSignals.push("The manager has accepted similar recommendations for this person.");
  }

  if (learning.managerOverridesToEmployee > 0) {
    learningSignals.push("The system has learned from previous corrections favouring this person.");
  }

  if (learning.managerOverridesAway > 0) {
    warnings.push("In similar cases the manager selected someone else.");
  }

  if (profile.incidentRate <= 0.02) {
    score += 5;
    reasons.push("Has no relevant recent incidents.");
  } else if (profile.incidentRate > 0.04) {
    score -= 6;
    warnings.push("Review incidents before assigning.");
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
    return "Ready for auto-assignment";
  }

  if (candidate.score >= 68) {
    return "High recommendation";
  }

  return "Review before assignment";
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
      employeeName: "Unassigned team",
      state: "Review before assignment",
      summary: "No person is clearly available. Review the schedule before confirming.",
      serviceFamily: serviceProfile.family,
      requiredSkills: serviceProfile.requiredSkills,
      estimatedDurationMinutes: serviceProfile.estimatedDurationMinutes,
      reasons: ["The request remains pending for manual review."],
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
      "Can cover the service if the manager prefers.",
    state: stateFromCandidate(candidate, serviceProfile),
  }));

  return {
    employeeName: best.employee.name,
    state,
    summary: `${best.employee.name} is the best option based on operational fit, schedule, and learned signals.`,
    serviceFamily: serviceProfile.family,
    requiredSkills: serviceProfile.requiredSkills,
    estimatedDurationMinutes: serviceProfile.estimatedDurationMinutes,
    reasons: best.reasons.slice(0, 4),
    learningSignals: best.learningSignals.slice(0, 3),
    warnings: best.warnings.slice(0, 3),
    alternatives,
    rejected,
    canAutoAssign: state === "Ready for auto-assignment",
    internalScore: Math.round(best.score),
  };
}
