export const dashboardMetrics = [
  {
    label: "Ingresos mes",
    value: 84250,
    displayValue: "84.250 €",
    delta: "+18,4 %",
    helper: "frente al mes anterior",
  },
  {
    label: "Servicios activos",
    value: 312,
    displayValue: "312",
    delta: "+42",
    helper: "limpiezas programadas",
  },
  {
    label: "Clientes activos",
    value: 148,
    displayValue: "148",
    delta: "+9",
    helper: "retención del 96 %",
  },
  {
    label: "Facturas pendientes",
    value: 19680,
    displayValue: "19.680 €",
    delta: "-7,2 %",
    helper: "cobro medio 8 días",
  },
  {
    label: "Nuevos leads",
    value: 37,
    displayValue: "37",
    delta: "+12",
    helper: "pipeline estimado 54.900 €",
  },
  {
    label: "SLA completado",
    value: 0.982,
    displayValue: "98,2 %",
    delta: "+1,8 %",
    helper: "servicios sin incidencia",
  },
];

export const revenueSeries = [
  { month: "Ene", revenue: 52500, services: 212 },
  { month: "Feb", revenue: 58200, services: 226 },
  { month: "Mar", revenue: 61150, services: 244 },
  { month: "Abr", revenue: 68400, services: 261 },
  { month: "May", revenue: 73550, services: 284 },
  { month: "Jun", revenue: 84250, services: 312 },
];

export const serviceMix = [
  { name: "Oficinas", value: 38 },
  { name: "Comunidades", value: 24 },
  { name: "Hoteles", value: 18 },
  { name: "Final de obra", value: 12 },
  { name: "Industrial", value: 8 },
];

export const employeePerformance = [
  { name: "Laura", score: 98, services: 48 },
  { name: "Miguel", score: 94, services: 42 },
  { name: "Nadia", score: 91, services: 39 },
  { name: "Hugo", score: 88, services: 36 },
  { name: "Irene", score: 86, services: 31 },
];

export const leadPipeline = [
  {
    status: "Nuevo",
    value: "12.400 €",
    count: 9,
    leads: ["Clínica Alameda", "Torres Norte", "Boreal Cowork"],
  },
  {
    status: "Cualificado",
    value: "21.600 €",
    count: 11,
    leads: ["Hotel Bruma", "Residencial Alba", "Mercado Centro"],
  },
  {
    status: "Presupuesto",
    value: "16.900 €",
    count: 7,
    leads: ["Logística Sur", "Nova Legal", "Café Distrito"],
  },
  {
    status: "Ganado",
    value: "4.000 €",
    count: 3,
    leads: ["Arco Dental", "Atrium Labs", "Mistral Hub"],
  },
];

export const customers = [
  {
    id: "cust-atrium",
    name: "Atrium Labs",
    type: "Oficinas",
    contact: "Marta Soler",
    email: "marta@atriumlabs.es",
    phone: "+34 611 204 338",
    status: "Activo",
    tags: ["B2B", "Madrid", "Premium"],
    lifetimeValue: 48600,
    nextService: "2026-06-01T08:30:00",
    address: "Calle Serrano 42, Madrid",
    risk: "Bajo",
    notes:
      "Cliente con servicio recurrente de lunes a viernes. Prefiere comunicación por correo.",
    serviceHistory: [
      "Limpieza integral oficinas - completada",
      "Reposición consumibles - completada",
      "Cristales exteriores - programada",
    ],
  },
  {
    id: "cust-alameda",
    name: "Clínica Alameda",
    type: "Sanitario",
    contact: "Dr. Javier Pardo",
    email: "administracion@clinicaalameda.es",
    phone: "+34 934 778 201",
    status: "En seguimiento",
    tags: ["Barcelona", "Alta prioridad"],
    lifetimeValue: 31200,
    nextService: "2026-06-02T07:00:00",
    address: "Avinguda Diagonal 318, Barcelona",
    risk: "Medio",
    notes:
      "Requiere protocolos reforzados y registro de productos desinfectantes.",
    serviceHistory: [
      "Desinfección zonas comunes - completada",
      "Auditoría de protocolo - pendiente",
    ],
  },
  {
    id: "cust-bruma",
    name: "Hotel Bruma",
    type: "Hotel",
    contact: "Lucía Ríos",
    email: "ops@hotelbruma.es",
    phone: "+34 965 222 910",
    status: "Activo",
    tags: ["Alicante", "Temporada alta"],
    lifetimeValue: 58400,
    nextService: "2026-05-30T10:00:00",
    address: "Paseo Marítimo 9, Alicante",
    risk: "Bajo",
    notes:
      "Contrato de refuerzo en verano. Facturación quincenal con IVA general.",
    serviceHistory: [
      "Habitaciones planta 5 - completada",
      "Zonas comunes - en curso",
      "Tapicería lobby - presupuestada",
    ],
  },
  {
    id: "cust-torres",
    name: "Comunidad Torres Norte",
    type: "Comunidad",
    contact: "Administrador Urbalia",
    email: "torresnorte@urbalia.es",
    phone: "+34 912 667 810",
    status: "Activo",
    tags: ["Comunidad", "Mensual"],
    lifetimeValue: 22800,
    nextService: "2026-06-03T09:00:00",
    address: "Calle de la Estación 14, Getafe",
    risk: "Bajo",
    notes:
      "Incluye garaje, portales y cristales. Revisar incidencias en ascensor B.",
    serviceHistory: [
      "Garaje - completada",
      "Portales - completada",
      "Cristales - programada",
    ],
  },
];

export const services = [
  {
    id: "srv-1001",
    title: "Limpieza diaria de oficinas",
    customer: "Atrium Labs",
    status: "Programado",
    recurrence: "Semanal",
    start: "2026-06-01T08:30:00",
    team: ["Laura Méndez", "Nadia Ramos"],
    city: "Madrid",
    price: 1260,
    vatRate: 21,
  },
  {
    id: "srv-1002",
    title: "Desinfección clínica",
    customer: "Clínica Alameda",
    status: "Pendiente",
    recurrence: "Puntual",
    start: "2026-06-02T07:00:00",
    team: ["Miguel Prieto"],
    city: "Barcelona",
    price: 780,
    vatRate: 21,
  },
  {
    id: "srv-1003",
    title: "Zonas comunes hotel",
    customer: "Hotel Bruma",
    status: "En curso",
    recurrence: "Diario",
    start: "2026-05-29T10:00:00",
    team: ["Irene Costa", "Hugo Vega"],
    city: "Alicante",
    price: 2150,
    vatRate: 21,
  },
  {
    id: "srv-1004",
    title: "Cristales y garaje",
    customer: "Comunidad Torres Norte",
    status: "Completado",
    recurrence: "Mensual",
    start: "2026-05-28T09:00:00",
    team: ["Nadia Ramos", "Hugo Vega"],
    city: "Getafe",
    price: 540,
    vatRate: 21,
  },
];

export const employees = [
  {
    id: "emp-laura",
    name: "Laura Méndez",
    role: "Jefa de equipo",
    status: "Disponible",
    availability: "L-V 07:00-15:00",
    jobs: 48,
    score: 98,
    revenue: 18400,
    notes: "Excelente valoración en oficinas premium.",
  },
  {
    id: "emp-miguel",
    name: "Miguel Prieto",
    role: "Especialista sanitario",
    status: "Asignado",
    availability: "L-S 06:00-14:00",
    jobs: 42,
    score: 94,
    revenue: 16250,
    notes: "Certificación en desinfección avanzada.",
  },
  {
    id: "emp-nadia",
    name: "Nadia Ramos",
    role: "Operaria senior",
    status: "Disponible",
    availability: "L-V 08:00-16:00",
    jobs: 39,
    score: 91,
    revenue: 14820,
    notes: "Buen encaje en comunidades y garajes.",
  },
  {
    id: "emp-hugo",
    name: "Hugo Vega",
    role: "Cristales y altura",
    status: "Vacaciones",
    availability: "Vuelve 2026-06-05",
    jobs: 36,
    score: 88,
    revenue: 13100,
    notes: "Planificar sustitución esta semana.",
  },
];

export const invoices = [
  {
    id: "inv-2026-0142",
    number: "F-2026-0142",
    customer: "Atrium Labs",
    status: "Pendiente",
    dueDate: "2026-06-06",
    subtotal: 4200,
    vat: 882,
    total: 5082,
  },
  {
    id: "inv-2026-0139",
    number: "F-2026-0139",
    customer: "Hotel Bruma",
    status: "Pagada",
    dueDate: "2026-05-27",
    subtotal: 6900,
    vat: 1449,
    total: 8349,
  },
  {
    id: "inv-2026-0134",
    number: "F-2026-0134",
    customer: "Comunidad Torres Norte",
    status: "Vencida",
    dueDate: "2026-05-20",
    subtotal: 1080,
    vat: 226.8,
    total: 1306.8,
  },
];

export const quotes = [
  {
    number: "P-2026-0048",
    customer: "Clínica Alameda",
    status: "Enviada",
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
    customer: "Logística Sur",
    status: "Borrador",
    total: 3872,
    validUntil: "2026-06-16",
  },
];

export const automations = [
  {
    name: "Recordatorio 24 h antes",
    trigger: "SERVICE_REMINDER",
    channel: "Email + SMS",
    status: "Activo",
    sent: 184,
    conversion: "91 %",
  },
  {
    name: "Confirmación al cliente",
    trigger: "SERVICE_CONFIRMATION",
    channel: "Email",
    status: "Activo",
    sent: 162,
    conversion: "98 %",
  },
  {
    name: "Solicitud de reseña",
    trigger: "REVIEW_REQUEST",
    channel: "Email",
    status: "Activo",
    sent: 73,
    conversion: "24 %",
  },
  {
    name: "Aviso de pago fallido",
    trigger: "FAILED_PAYMENT",
    channel: "Email",
    status: "Pausado",
    sent: 6,
    conversion: "50 %",
  },
];

export const subscriptionPlans = [
  {
    name: "Starter",
    price: "59 €",
    description: "Hasta 5 empleados y facturación básica.",
    features: ["CRM", "Calendario", "Facturas con IVA"],
    priceEnv: "STRIPE_PRICE_STARTER",
  },
  {
    name: "Growth",
    price: "149 €",
    description: "Operaciones completas para equipos en crecimiento.",
    features: ["Automatizaciones", "Portal cliente", "Stripe"],
    priceEnv: "STRIPE_PRICE_GROWTH",
    highlighted: true,
  },
  {
    name: "Scale",
    price: "299 €",
    description: "Multi-sede, analítica avanzada y soporte prioritario.",
    features: ["Panel SaaS", "MRR", "Churn", "Roles avanzados"],
    priceEnv: "STRIPE_PRICE_SCALE",
  },
];

export const adminCompanies = [
  {
    name: "Brillo Norte SL",
    plan: "Growth",
    mrr: 149,
    status: "Activo",
    users: 18,
    churnRisk: "Bajo",
  },
  {
    name: "Limpiezas Mediterráneo",
    plan: "Scale",
    mrr: 299,
    status: "Activo",
    users: 43,
    churnRisk: "Bajo",
  },
  {
    name: "EcoHogar Madrid",
    plan: "Starter",
    mrr: 59,
    status: "Past due",
    users: 6,
    churnRisk: "Alto",
  },
  {
    name: "Pulcro Empresas",
    plan: "Growth",
    mrr: 149,
    status: "Trial",
    users: 11,
    churnRisk: "Medio",
  },
];

export const scheduleColumns = [
  {
    id: "monday",
    label: "Lunes 1",
    appointments: [
      {
        id: "apt-1",
        time: "08:30",
        title: "Atrium Labs",
        team: "Laura + Nadia",
        status: "Programado",
      },
      {
        id: "apt-2",
        time: "13:00",
        title: "Nova Legal",
        team: "Miguel",
        status: "Pendiente",
      },
    ],
  },
  {
    id: "tuesday",
    label: "Martes 2",
    appointments: [
      {
        id: "apt-3",
        time: "07:00",
        title: "Clínica Alameda",
        team: "Miguel",
        status: "Pendiente",
      },
    ],
  },
  {
    id: "wednesday",
    label: "Miércoles 3",
    appointments: [
      {
        id: "apt-4",
        time: "09:00",
        title: "Torres Norte",
        team: "Nadia + Hugo",
        status: "Programado",
      },
    ],
  },
  {
    id: "thursday",
    label: "Jueves 4",
    appointments: [
      {
        id: "apt-5",
        time: "10:30",
        title: "Hotel Bruma",
        team: "Irene + Hugo",
        status: "En curso",
      },
    ],
  },
  {
    id: "friday",
    label: "Viernes 5",
    appointments: [
      {
        id: "apt-6",
        time: "12:00",
        title: "Logística Sur",
        team: "Laura",
        status: "Presupuesto",
      },
    ],
  },
];
