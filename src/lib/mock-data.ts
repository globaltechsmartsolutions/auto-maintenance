export const dashboardMetrics = [
  {
    label: "Monthly revenue",
    value: 84250,
    displayValue: "€84,250",
    delta: "+18.4%",
    helper: "compared with the previous month",
  },
  {
    label: "Active services",
    value: 312,
    displayValue: "312",
    delta: "+42",
    helper: "scheduled services",
  },
  {
    label: "Active customers",
    value: 148,
    displayValue: "148",
    delta: "+9",
    helper: "96% retention",
  },
  {
    label: "Pending invoices",
    value: 19680,
    displayValue: "€19,680",
    delta: "-7.2%",
    helper: "average collection time: 8 days",
  },
  {
    label: "New leads",
    value: 37,
    displayValue: "37",
    delta: "+12",
    helper: "estimated pipeline: €54,900",
  },
  {
    label: "SLA met",
    value: 0.982,
    displayValue: "98.2%",
    delta: "+1.8%",
    helper: "services without incidents",
  },
];

export const revenueSeries = [
  { month: "Jan", revenue: 52500, services: 212 },
  { month: "Feb", revenue: 58200, services: 226 },
  { month: "Mar", revenue: 61150, services: 244 },
  { month: "Apr", revenue: 68400, services: 261 },
  { month: "May", revenue: 73550, services: 284 },
  { month: "Jun", revenue: 84250, services: 312 },
];

export const serviceMix = [
  { name: "Offices", value: 38 },
  { name: "Communities", value: 24 },
  { name: "Hotels", value: 18 },
  { name: "Post-construction", value: 12 },
  { name: "Industrial", value: 8 },
];

export const employeePerformance = [
  { name: "Laura", score: 98, services: 48 },
  { name: "Miguel", score: 94, services: 42 },
  { name: "Nadia", score: 91, services: 39 },
  { name: "Hugo", score: 88, services: 36 },
  { name: "Irene", score: 86, services: 31 },
];

export const operationsBrief = [
  {
    title: "Close healthcare quote",
    customer: "Alameda Clinic",
    status: "Pending",
    impact: "€943 today / €3,800 potential monthly",
    helper: "Review the disinfection protocol before 12:00.",
  },
  {
    title: "Reassign team due to absence",
    customer: "Northern Towers Community",
    status: "Follow-up",
    impact: "Critical monthly service",
    helper: "Hugo is on holiday; Nadia can cover interior windows.",
  },
  {
    title: "Confirm premium expansion",
    customer: "Atrium Labs",
    status: "Scheduled",
    impact: "+€1,260 in recurring revenue",
    helper: "Add exterior window cleaning and consumables restocking.",
  },
];

export const leadPipeline = [
  {
    status: "New",
    value: "€12,400",
    count: 9,
    leads: ["Alameda Clinic", "Northern Towers", "Boreal Cowork"],
  },
  {
    status: "Qualified",
    value: "€21,600",
    count: 11,
    leads: ["Hotel Bruma", "Residencial Alba", "Central Market"],
  },
  {
    status: "Quote",
    value: "€16,900",
    count: 7,
    leads: ["Southern Logistics", "Nova Legal", "District Cafe"],
  },
  {
    status: "Won",
    value: "€4,000",
    count: 3,
    leads: ["Arco Dental", "Atrium Labs", "Mistral Hub"],
  },
];

export const customerSegments = [
  {
    name: "Premium B2B",
    count: 18,
    revenue: 128400,
    conversion: "96 %",
    action: "Renew annual contracts before July.",
    description: "Offices, practices, and laboratories with recurring service.",
  },
  {
    name: "High priority",
    count: 9,
    revenue: 72600,
    conversion: "84 %",
    action: "Sales follow-up every 72 hours.",
    description: "Customers with an open opportunity or specific operational risk.",
  },
  {
    name: "Communityes mensuales",
    count: 34,
    revenue: 91800,
    conversion: "91 %",
    action: "Offer window cleaning, garage cleaning, and seasonal maintenance.",
    description: "Property managers with predictable contracts.",
  },
  {
    name: "High season",
    count: 12,
    revenue: 104500,
    conversion: "78 %",
    action: "Block availability for June and July.",
    description: "Hotels, holiday rentals, and one-off staffing support.",
  },
];

export const customers = [
  {
    id: "cust-atrium",
    name: "Atrium Labs",
    type: "Offices",
    contact: "Marta Soler",
    email: "marta@atriumlabs.com",
    phone: "+34 611 204 338",
    status: "Active",
    tags: ["B2B", "Madrid", "Premium"],
    lifetimeValue: 48600,
    nextService: "2026-06-15T08:30:00",
    address: "Calle Serrano 42, Madrid",
    risk: "Low",
    notes:
      "Customer with recurring service from Monday to Friday. Prefers email communication.",
    serviceHistory: [
      "Full office cleaning - completed",
      "Consumables restocking - completed",
      "Exterior windows - scheduled",
    ],
  },
  {
    id: "cust-alameda",
    name: "Alameda Clinic",
    type: "Healthcare",
    contact: "Dr. Javier Pardo",
    email: "administration@alamedaclinic.com",
    phone: "+34 934 778 201",
    status: "Follow-up",
    tags: ["Barcelona", "High priority"],
    lifetimeValue: 31200,
    nextService: "2026-06-16T07:00:00",
    address: "Avinguda Diagonal 318, Barcelona",
    risk: "Medium",
    notes:
      "Requires enhanced protocols and a disinfectant product log.",
    serviceHistory: [
      "Common-area disinfection - completed",
      "Protocol audit - pending",
    ],
  },
  {
    id: "cust-bruma",
    name: "Hotel Bruma",
    type: "Hotel",
    contact: "Lucía Ríos",
    email: "ops@brumahotel.com",
    phone: "+34 965 222 910",
    status: "Active",
    tags: ["Alicante", "High season"],
    lifetimeValue: 58400,
    nextService: "2026-06-18T10:00:00",
    address: "9 Seafront Avenue, Alicante",
    risk: "Low",
    notes:
      "Summer support contract. Fortnightly billing with standard VAT.",
    serviceHistory: [
      "Fifth-floor rooms - completed",
      "Common areas - in progress",
      "Lobby upholstery - quoted",
    ],
  },
  {
    id: "cust-torres",
    name: "Northern Towers Community",
    type: "Community",
    contact: "Urbalia Administrator",
    email: "northerntowers@urbalia.com",
    phone: "+34 912 667 810",
    status: "Active",
    tags: ["Community", "Monthly"],
    lifetimeValue: 22800,
    nextService: "2026-06-03T09:00:00",
    address: "14 Station Street, Getafe",
    risk: "Low",
    notes:
      "Includes garage, entrances, and windows. Review lift B incidents.",
    serviceHistory: [
      "Garage - completed",
      "Entrances - completed",
      "Windows - scheduled",
    ],
  },
];

export const customerPlaybook = {
  "cust-atrium": {
    nextAction: "Propose annual renewal with exterior window cleaning expansion.",
    opportunity: "Increase recurring contract by €1,260 per month.",
    risk: "Low: satisfied customer, but expects a quick incident response.",
    internalNote: "Marta wants a monthly summary of services and consumables.",
  },
  "cust-alameda": {
    nextAction: "Send the healthcare protocol and convert the quote into a service.",
    opportunity: "Recurring disinfection service worth €3,800 per month.",
    risk: "Medium: requires product traceability and a certified team.",
    internalNote: "Do not call during consultation hours; email before 10:00 is preferable.",
  },
  "cust-bruma": {
    nextAction: "Close the peak-season support agreement for June and July.",
    opportunity: "Temporary €8,400 expansion with common-area cleaning.",
    risk: "Low: high volume, but requires weekend coverage.",
    internalNote: "Lucia approves quickly when floor-by-floor planning is included.",
  },
  "cust-torres": {
    nextAction: "Review the lift B incident and confirm Hugo's replacement.",
    opportunity: "Add quarterly window cleaning and deep garage cleaning.",
    risk: "Low: stable contract with sensitivity to visible incidents.",
    internalNote: "The administrator requests before-and-after photos for every monthly visit.",
  },
};

export const services = [
  {
    id: "srv-1001",
    title: "Daily office cleaning",
    customer: "Atrium Labs",
    status: "Scheduled",
    recurrence: "Weekly",
    start: "2026-06-15T08:30:00",
    team: ["Laura Méndez", "Nadia Ramos"],
    city: "Madrid",
    price: 1260,
    vatRate: 21,
  },
  {
    id: "srv-1002",
    title: "Clinic disinfection",
    customer: "Alameda Clinic",
    status: "Pending",
    recurrence: "One-time",
    start: "2026-06-16T07:00:00",
    team: ["Miguel Prieto"],
    city: "Barcelona",
    price: 780,
    vatRate: 21,
  },
  {
    id: "srv-1003",
    title: "Hotel common areas",
    customer: "Hotel Bruma",
    status: "Scheduled",
    recurrence: "Daily",
    start: "2026-06-18T10:00:00",
    team: ["Irene Costa", "Hugo Vega"],
    city: "Alicante",
    price: 2150,
    vatRate: 21,
  },
  {
    id: "srv-1004",
    title: "Windows and garage",
    customer: "Northern Towers Community",
    status: "Completed",
    recurrence: "Monthly",
    start: "2026-06-10T09:00:00",
    team: ["Nadia Ramos", "Hugo Vega"],
    city: "Getafe",
    price: 540,
    vatRate: 21,
  },
];

export const serviceHealth = [
  {
    label: "Critical services today",
    value: "7",
    helper: "2 healthcare sites, 3 premium offices, and 2 hotels.",
    status: "Scheduled",
  },
  {
    label: "Teams with capacity",
    value: "5",
    helper: "Available for emergencies or expansions.",
    status: "Active",
  },
  {
    label: "Open incidents",
    value: "2",
    helper: "Lift B and consumables restocking.",
    status: "Follow-up",
  },
];

export const employees = [
  {
    id: "emp-laura",
    name: "Laura Méndez",
    role: "Team lead",
    status: "Available",
    availability: "Mon-Fri 07:00-15:00",
    jobs: 48,
    score: 98,
    revenue: 18400,
    notes: "Excellent rating for premium offices.",
  },
  {
    id: "emp-miguel",
    name: "Miguel Prieto",
    role: "Healthcare specialist",
    status: "Assigned",
    availability: "Mon-Sat 06:00-14:00",
    jobs: 42,
    score: 94,
    revenue: 16250,
    notes: "Advanced disinfection certification.",
  },
  {
    id: "emp-nadia",
    name: "Nadia Ramos",
    role: "Senior operator",
    status: "Available",
    availability: "Mon-Fri 08:00-16:00",
    jobs: 39,
    score: 91,
    revenue: 14820,
    notes: "Good fit for residential communities and garages.",
  },
  {
    id: "emp-hugo",
    name: "Hugo Vega",
    role: "Windows and high-rise",
    status: "Holiday",
    availability: "Returns 2026-06-05",
    jobs: 36,
    score: 88,
    revenue: 13100,
    notes: "Plan a replacement this week.",
  },
  {
    id: "emp-irene",
    name: "Irene Costa",
    role: "Hotel specialist",
    status: "Available",
    availability: "Mon-Sat 08:00-17:00",
    jobs: 31,
    score: 86,
    revenue: 11900,
    notes: "Support for hotels, common areas, and peak season.",
  },
];

export const invoices = [
  {
    id: "inv-2026-0142",
    number: "F-2026-0142",
    customer: "Atrium Labs",
    status: "Pending",
    dueDate: "2026-06-06",
    subtotal: 4200,
    vat: 882,
    total: 5082,
  },
  {
    id: "inv-2026-0139",
    number: "F-2026-0139",
    customer: "Hotel Bruma",
    status: "Paid",
    dueDate: "2026-05-27",
    subtotal: 6900,
    vat: 1449,
    total: 8349,
  },
  {
    id: "inv-2026-0134",
    number: "F-2026-0134",
    customer: "Northern Towers Community",
    status: "Overdue",
    dueDate: "2026-05-20",
    subtotal: 1080,
    vat: 226.8,
    total: 1306.8,
  },
];

export const quotes = [
  {
    number: "P-2026-0048",
    customer: "Alameda Clinic",
    status: "Sent",
    total: 943.8,
    validUntil: "2026-06-12",
  },
  {
    number: "P-2026-0047",
    customer: "Nova Legal",
    status: "Aceptada",
    total: 1815,
    validUntil: "2026-06-03",
  },
  {
    number: "P-2026-0046",
    customer: "Southern Logistics",
    status: "Draft",
    total: 3872,
    validUntil: "2026-06-16",
  },
];

export const automations = [
  {
    name: "24-hour reminder",
    trigger: "SERVICE_REMINDER",
    channel: "Email + SMS",
    status: "Active",
    sent: 184,
    conversion: "91 %",
  },
  {
    name: "Customer confirmation",
    trigger: "SERVICE_CONFIRMATION",
    channel: "Email",
    status: "Active",
    sent: 162,
    conversion: "98 %",
  },
  {
    name: "Review request",
    trigger: "REVIEW_REQUEST",
    channel: "Email",
    status: "Active",
    sent: 73,
    conversion: "24 %",
  },
  {
    name: "Failed payment notice",
    trigger: "FAILED_PAYMENT",
    channel: "Email",
    status: "Paused",
    sent: 6,
    conversion: "50 %",
  },
];

export const subscriptionPlans = [
  {
    name: "Starter",
    code: "STARTER",
    price: "59 €",
    description: "Up to 5 employees and basic billing.",
    features: ["CRM", "Calendar", "VAT invoices"],
    highlighted: false,
  },
  {
    name: "Growth",
    code: "GROWTH",
    price: "149 €",
    description: "Complete operations for growing teams.",
    features: ["Automations", "Customer portal", "Stripe"],
    highlighted: true,
  },
  {
    name: "Scale",
    code: "SCALE",
    price: "299 €",
    description: "Multi-site, advanced analytics, and priority support.",
    features: ["SaaS dashboard", "MRR", "Churn", "Advanced roles"],
    highlighted: false,
  },
] as const;

export const adminCompanies = [
  {
    name: "Brillo Norte SL",
    plan: "Growth",
    mrr: 149,
    status: "Active",
    users: 18,
    churnRisk: "Low",
  },
  {
    name: "Mediterranean Cleaning",
    plan: "Scale",
    mrr: 299,
    status: "Active",
    users: 43,
    churnRisk: "Low",
  },
  {
    name: "EcoHogar Madrid",
    plan: "Starter",
    mrr: 59,
    status: "Past due",
    users: 6,
    churnRisk: "High",
  },
  {
    name: "Pulcro Companys",
    plan: "Growth",
    mrr: 149,
    status: "Trial",
    users: 11,
    churnRisk: "Medium",
  },
];

export const scheduleColumns = [
  {
    id: "monday",
    label: "Monday 1",
    appointments: [
      {
        id: "apt-1",
        time: "08:30",
        title: "Atrium Labs",
        team: "Laura + Nadia",
        status: "Scheduled",
      },
      {
        id: "apt-2",
        time: "13:00",
        title: "Nova Legal",
        team: "Miguel",
        status: "Pending",
      },
    ],
  },
  {
    id: "tuesday",
    label: "Tuesday 2",
    appointments: [
      {
        id: "apt-3",
        time: "07:00",
        title: "Alameda Clinic",
        team: "Miguel",
        status: "Pending",
      },
    ],
  },
  {
    id: "wednesday",
    label: "Wednesday 3",
    appointments: [
      {
        id: "apt-4",
        time: "09:00",
        title: "Northern Towers",
        team: "Nadia + Hugo",
        status: "Scheduled",
      },
    ],
  },
  {
    id: "thursday",
    label: "Thursday 4",
    appointments: [
      {
        id: "apt-5",
        time: "10:30",
        title: "Hotel Bruma",
        team: "Irene + Hugo",
        status: "In progress",
      },
    ],
  },
  {
    id: "friday",
    label: "Friday 5",
    appointments: [
      {
        id: "apt-6",
        time: "12:00",
        title: "Southern Logistics",
        team: "Laura",
        status: "Quote",
      },
    ],
  },
];
