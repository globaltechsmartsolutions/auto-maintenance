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

export const operationsBrief = [
  {
    title: "Cerrar presupuesto sanitario",
    customer: "Clínica Alameda",
    status: "Pendiente",
    impact: "943 € hoy / 3.800 € mensual potencial",
    helper: "Revisar protocolo de desinfección antes de las 12:00.",
  },
  {
    title: "Reasignar equipo por ausencia",
    customer: "Comunidad Torres Norte",
    status: "En seguimiento",
    impact: "Servicio mensual crítico",
    helper: "Hugo está de vacaciones; Nadia puede cubrir cristales interiores.",
  },
  {
    title: "Confirmar ampliación premium",
    customer: "Atrium Labs",
    status: "Programado",
    impact: "+1.260 € de ticket recurrente",
    helper: "Añadir cristales exteriores y reposición de consumibles.",
  },
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

export const customerSegments = [
  {
    name: "Premium B2B",
    count: 18,
    revenue: 128400,
    conversion: "96 %",
    action: "Renovar contratos anuales antes de julio.",
    description: "Oficinas, despachos y laboratorios con servicio recurrente.",
  },
  {
    name: "Alta prioridad",
    count: 9,
    revenue: 72600,
    conversion: "84 %",
    action: "Seguimiento comercial cada 72 horas.",
    description: "Clientes con oportunidad abierta o riesgo operativo puntual.",
  },
  {
    name: "Comunidades mensuales",
    count: 34,
    revenue: 91800,
    conversion: "91 %",
    action: "Ofrecer cristales, garaje y mantenimiento estacional.",
    description: "Administradores de fincas con contratos previsibles.",
  },
  {
    name: "Temporada alta",
    count: 12,
    revenue: 104500,
    conversion: "78 %",
    action: "Bloquear disponibilidad de junio y julio.",
    description: "Hoteles, alquiler vacacional y refuerzos puntuales.",
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
    nextService: "2026-06-15T08:30:00",
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
    nextService: "2026-06-16T07:00:00",
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
    nextService: "2026-06-18T10:00:00",
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

export const customerPlaybook = {
  "cust-atrium": {
    nextAction: "Proponer renovación anual con ampliación de cristales exteriores.",
    opportunity: "Incrementar contrato recurrente en 1.260 € mensuales.",
    risk: "Bajo: cliente satisfecho, pero pide respuesta rápida en incidencias.",
    internalNote: "Marta quiere recibir un resumen mensual de servicios y consumibles.",
  },
  "cust-alameda": {
    nextAction: "Enviar protocolo sanitario y convertir presupuesto en servicio.",
    opportunity: "Servicio recurrente de desinfección de 3.800 € mensuales.",
    risk: "Medio: exige trazabilidad de productos y equipo certificado.",
    internalNote: "No llamar durante horario de consulta; mejor correo antes de las 10:00.",
  },
  "cust-bruma": {
    nextAction: "Cerrar refuerzo de temporada alta para junio y julio.",
    opportunity: "Ampliación temporal de 8.400 € con limpieza de zonas comunes.",
    risk: "Bajo: alto volumen, pero necesita cobertura de fines de semana.",
    internalNote: "Lucía aprueba rápido si se incluye planificación por plantas.",
  },
  "cust-torres": {
    nextAction: "Revisar incidencia del ascensor B y confirmar sustitución de Hugo.",
    opportunity: "Añadir cristales trimestrales y limpieza de garaje profunda.",
    risk: "Bajo: contrato estable con sensibilidad a incidencias visibles.",
    internalNote: "El administrador pide fotos de antes/después en cada visita mensual.",
  },
};

export const services = [
  {
    id: "srv-1001",
    title: "Limpieza diaria de oficinas",
    customer: "Atrium Labs",
    status: "Programado",
    recurrence: "Semanal",
    start: "2026-06-15T08:30:00",
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
    start: "2026-06-16T07:00:00",
    team: ["Miguel Prieto"],
    city: "Barcelona",
    price: 780,
    vatRate: 21,
  },
  {
    id: "srv-1003",
    title: "Zonas comunes hotel",
    customer: "Hotel Bruma",
    status: "Programado",
    recurrence: "Diario",
    start: "2026-06-18T10:00:00",
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
    start: "2026-06-10T09:00:00",
    team: ["Nadia Ramos", "Hugo Vega"],
    city: "Getafe",
    price: 540,
    vatRate: 21,
  },
];

export const serviceHealth = [
  {
    label: "Servicios críticos hoy",
    value: "7",
    helper: "2 sanitarios, 3 oficinas premium y 2 hoteles.",
    status: "Programado",
  },
  {
    label: "Equipos con margen",
    value: "5",
    helper: "Disponibles para urgencias o ampliaciones.",
    status: "Activo",
  },
  {
    label: "Incidencias abiertas",
    value: "2",
    helper: "Ascensor B y reposición de consumibles.",
    status: "En seguimiento",
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
  {
    id: "emp-irene",
    name: "Irene Costa",
    role: "Especialista hoteles",
    status: "Disponible",
    availability: "L-S 08:00-17:00",
    jobs: 31,
    score: 86,
    revenue: 11900,
    notes: "Refuerzo de hoteles, zonas comunes y temporada alta.",
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
