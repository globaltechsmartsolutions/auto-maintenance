import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run prisma/seed.mjs");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const ids = {
  company: "seed-company-limpiapro-demo",
  users: {
    admin: "seed-user-admin",
    manager: "seed-user-manager",
    employee: "seed-user-employee",
    employee2: "seed-user-employee-2",
  },
  employees: {
    laura: "seed-employee-laura",
    miguel: "seed-employee-miguel",
    nadia: "seed-employee-nadia",
    hugo: "seed-employee-hugo",
  },
  customers: {
    atrium: "seed-customer-atrium",
    alameda: "seed-customer-alameda",
    bruma: "seed-customer-bruma",
    torres: "seed-customer-torres",
    logistica: "seed-customer-logistica-sur",
  },
};

const date = (value) => new Date(value);

async function seedCompany() {
  return prisma.company.upsert({
    where: { id: ids.company },
    update: {
      plan: "GROWTH",
      subscriptionStatus: "TRIALING",
      billingEmail: "facturacion@limpiezasdemo.es",
    },
    create: {
      id: ids.company,
      name: "Limpiezas Demo SL",
      fiscalName: "Limpiezas Demo Sociedad Limitada",
      cif: "B10999888",
      email: "hola@limpiezasdemo.es",
      phone: "+34 910 220 330",
      website: "https://limpiezasdemo.es",
      address: "Calle Serrano 42",
      city: "Madrid",
      province: "Madrid",
      postalCode: "28001",
      billingEmail: "facturacion@limpiezasdemo.es",
      plan: "GROWTH",
      subscriptionStatus: "TRIALING",
      trialEndsAt: date("2026-06-30T23:59:59.000Z"),
    },
  });
}

async function seedUsers() {
  const users = [
    {
      id: ids.users.admin,
      supabaseUserId: "seed-supabase-admin",
      email: "admin@limpiezasdemo.es",
      firstName: "Alejandro",
      lastName: "Martín",
      role: "ADMIN",
      status: "ACTIVE",
    },
    {
      id: ids.users.manager,
      supabaseUserId: "seed-supabase-manager",
      email: "manager@limpiezasdemo.es",
      firstName: "Marta",
      lastName: "Soler",
      role: "MANAGER",
      status: "ACTIVE",
    },
    {
      id: ids.users.employee,
      supabaseUserId: "seed-supabase-employee",
      email: "laura@limpiezasdemo.es",
      firstName: "Laura",
      lastName: "Méndez",
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
    {
      id: ids.users.employee2,
      supabaseUserId: "seed-supabase-employee-2",
      email: "miguel@limpiezasdemo.es",
      firstName: "Miguel",
      lastName: "Prieto",
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        companyId: ids.company,
        role: user.role,
        status: user.status,
      },
      create: {
        ...user,
        companyId: ids.company,
      },
    });
  }
}

async function seedEmployees() {
  const employees = [
    {
      id: ids.employees.laura,
      userId: ids.users.employee,
      position: "Jefa de equipo",
      hourlyRate: 18.5,
      performanceScore: 98,
      availability: { days: ["L", "M", "X", "J", "V"], from: "07:00", to: "15:00" },
      internalNotes: "Excelente valoración en oficinas premium.",
      hiredAt: date("2024-02-12T00:00:00.000Z"),
    },
    {
      id: ids.employees.miguel,
      userId: ids.users.employee2,
      position: "Especialista sanitario",
      hourlyRate: 19.25,
      performanceScore: 94,
      availability: { days: ["L", "M", "X", "J", "V", "S"], from: "06:00", to: "14:00" },
      internalNotes: "Certificación en desinfección avanzada.",
      hiredAt: date("2023-11-03T00:00:00.000Z"),
    },
    {
      id: ids.employees.nadia,
      userId: ids.users.manager,
      position: "Coordinadora operativa",
      hourlyRate: 21,
      performanceScore: 91,
      availability: { days: ["L", "M", "X", "J", "V"], from: "08:00", to: "16:00" },
      internalNotes: "Buen encaje en comunidades y garajes.",
      hiredAt: date("2022-06-20T00:00:00.000Z"),
    },
    {
      id: ids.employees.hugo,
      userId: ids.users.admin,
      position: "Supervisor de cuentas",
      hourlyRate: 24,
      performanceScore: 88,
      availability: { status: "vacaciones", returnsAt: "2026-06-05" },
      internalNotes: "Planificar sustitución esta semana.",
      hiredAt: date("2021-09-15T00:00:00.000Z"),
    },
  ];

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { id: employee.id },
      update: {
        position: employee.position,
        hourlyRate: employee.hourlyRate,
        availability: employee.availability,
        performanceScore: employee.performanceScore,
        internalNotes: employee.internalNotes,
      },
      create: {
        ...employee,
        companyId: ids.company,
      },
    });
  }
}

async function seedCustomers() {
  const customers = [
    {
      id: ids.customers.atrium,
      name: "Atrium Labs",
      type: "BUSINESS",
      status: "ACTIVE",
      email: "marta@atriumlabs.es",
      phone: "+34 611 204 338",
      nif: "B88321190",
      address: "Calle Serrano 42",
      city: "Madrid",
      province: "Madrid",
      postalCode: "28001",
      tags: ["B2B", "Madrid", "Premium"],
      notes: "Servicio recurrente de lunes a viernes. Prefiere comunicación por correo.",
      lifetimeValue: 48600,
    },
    {
      id: ids.customers.alameda,
      name: "Clínica Alameda",
      type: "BUSINESS",
      status: "AT_RISK",
      email: "administracion@clinicaalameda.es",
      phone: "+34 934 778 201",
      nif: "B64112003",
      address: "Avinguda Diagonal 318",
      city: "Barcelona",
      province: "Barcelona",
      postalCode: "08013",
      tags: ["Barcelona", "Alta prioridad", "Sanitario"],
      notes: "Requiere protocolos reforzados y registro de productos desinfectantes.",
      lifetimeValue: 31200,
    },
    {
      id: ids.customers.bruma,
      name: "Hotel Bruma",
      type: "BUSINESS",
      status: "ACTIVE",
      email: "ops@hotelbruma.es",
      phone: "+34 965 222 910",
      nif: "B54388112",
      address: "Paseo Marítimo 9",
      city: "Alicante",
      province: "Alicante",
      postalCode: "03002",
      tags: ["Alicante", "Temporada alta"],
      notes: "Contrato de refuerzo en verano. Facturación quincenal con IVA general.",
      lifetimeValue: 58400,
    },
    {
      id: ids.customers.torres,
      name: "Comunidad Torres Norte",
      type: "COMMUNITY",
      status: "ACTIVE",
      email: "torresnorte@urbalia.es",
      phone: "+34 912 667 810",
      nif: "H87990111",
      address: "Calle de la Estación 14",
      city: "Getafe",
      province: "Madrid",
      postalCode: "28901",
      tags: ["Comunidad", "Mensual"],
      notes: "Incluye garaje, portales y cristales. Revisar incidencias en ascensor B.",
      lifetimeValue: 22800,
    },
    {
      id: ids.customers.logistica,
      name: "Logística Sur",
      type: "INDUSTRIAL",
      status: "ACTIVE",
      email: "operaciones@logisticasur.es",
      phone: "+34 955 440 802",
      nif: "B91700123",
      address: "Polígono La Isla, nave 18",
      city: "Dos Hermanas",
      province: "Sevilla",
      postalCode: "41703",
      tags: ["Industrial", "Sevilla", "Presupuesto"],
      notes: "Necesita limpieza de almacén y oficinas anexas.",
      lifetimeValue: 17400,
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: customer,
      create: {
        ...customer,
        companyId: ids.company,
      },
    });
  }
}

async function seedLeads() {
  const leads = [
    ["seed-lead-clinica-alameda", "Clínica Alameda", "Clínica Alameda", "QUALIFIED", 3800, 75, ["Sanitario"]],
    ["seed-lead-torres-norte", "Administrador Urbalia", "Comunidad Torres Norte", "NEW", 1200, 45, ["Comunidad"]],
    ["seed-lead-boreal", "Ana Ferrer", "Boreal Cowork", "NEW", 2400, 35, ["Coworking"]],
    ["seed-lead-hotel-bruma", "Lucía Ríos", "Hotel Bruma", "QUOTED", 8400, 80, ["Hotel"]],
    ["seed-lead-residencial-alba", "Residencial Alba", "Residencial Alba", "QUALIFIED", 2100, 60, ["Comunidad"]],
    ["seed-lead-mercado-centro", "Mercado Centro", "Mercado Centro", "QUALIFIED", 1900, 55, ["Retail"]],
    ["seed-lead-nova-legal", "Nova Legal", "Nova Legal", "WON", 1500, 100, ["Oficinas"]],
    ["seed-lead-logistica-sur", "Logística Sur", "Logística Sur", "QUOTED", 3200, 70, ["Industrial"]],
  ];

  for (const [id, name, companyName, status, estimatedValue, probability, tags] of leads) {
    await prisma.lead.upsert({
      where: { id },
      update: { status, estimatedValue, probability, tags },
      create: {
        id,
        companyId: ids.company,
        assignedToId: ids.users.manager,
        name,
        companyName,
        email: `${companyName.toLowerCase().replaceAll(" ", ".")}@demo.es`,
        phone: "+34 600 000 000",
        source: "Demo preproducción",
        status,
        estimatedValue,
        probability,
        nextFollowUp: date("2026-06-04T09:00:00.000Z"),
        tags,
      },
    });
  }
}

async function seedServices() {
  const services = [
    ["seed-service-atrium-office", ids.customers.atrium, "Limpieza diaria de oficinas", "Oficinas", "WEEKLY", "SCHEDULED", "2026-06-01T08:30:00.000Z", 1260],
    ["seed-service-alameda-clinic", ids.customers.alameda, "Desinfección clínica", "Sanitario", "ONE_TIME", "PENDING", "2026-06-02T07:00:00.000Z", 780],
    ["seed-service-bruma-common", ids.customers.bruma, "Zonas comunes hotel", "Hotel", "DAILY", "IN_PROGRESS", "2026-05-29T10:00:00.000Z", 2150],
    ["seed-service-torres-garage", ids.customers.torres, "Cristales y garaje", "Comunidad", "MONTHLY", "COMPLETED", "2026-05-28T09:00:00.000Z", 540],
    ["seed-service-atrium-consumables", ids.customers.atrium, "Reposición de consumibles", "Oficinas", "MONTHLY", "SCHEDULED", "2026-06-03T11:00:00.000Z", 360],
    ["seed-service-bruma-lobby", ids.customers.bruma, "Tapicería lobby", "Hotel", "ONE_TIME", "PENDING", "2026-06-07T10:00:00.000Z", 980],
    ["seed-service-logistica-warehouse", ids.customers.logistica, "Limpieza almacén", "Industrial", "ONE_TIME", "SCHEDULED", "2026-06-05T06:30:00.000Z", 3200],
    ["seed-service-torres-portals", ids.customers.torres, "Portales y ascensores", "Comunidad", "WEEKLY", "SCHEDULED", "2026-06-06T08:00:00.000Z", 620],
  ];

  for (const [id, customerId, title, serviceType, recurrence, status, start, price] of services) {
    await prisma.service.upsert({
      where: { id },
      update: { status, scheduledStart: date(start), price },
      create: {
        id,
        companyId: ids.company,
        customerId,
        title,
        serviceType,
        recurrence,
        status,
        scheduledStart: date(start),
        scheduledEnd: date(start),
        city: "Madrid",
        price,
        vatRate: 21,
      },
    });
  }

  const assignments = [
    ["seed-service-atrium-office", ids.employees.laura],
    ["seed-service-atrium-office", ids.employees.nadia],
    ["seed-service-alameda-clinic", ids.employees.miguel],
    ["seed-service-bruma-common", ids.employees.hugo],
    ["seed-service-torres-garage", ids.employees.nadia],
    ["seed-service-logistica-warehouse", ids.employees.laura],
  ];

  for (const [serviceId, employeeId] of assignments) {
    await prisma.serviceAssignment.upsert({
      where: { serviceId_employeeId: { serviceId, employeeId } },
      update: {},
      create: { serviceId, employeeId },
    });
  }
}

async function seedQuotesAndInvoices() {
  const quotes = [
    ["seed-quote-alameda", ids.customers.alameda, "P-2026-0048", "SENT", 780],
    ["seed-quote-nova", ids.customers.atrium, "P-2026-0047", "ACCEPTED", 1500],
    ["seed-quote-logistica", ids.customers.logistica, "P-2026-0046", "DRAFT", 3200],
  ];

  for (const [id, customerId, number, status, subtotal] of quotes) {
    await prisma.quote.upsert({
      where: { id },
      update: { status, subtotal, vatAmount: subtotal * 0.21, total: subtotal * 1.21 },
      create: {
        id,
        companyId: ids.company,
        customerId,
        number,
        status,
        validUntil: date("2026-06-15T00:00:00.000Z"),
        subtotal,
        vatAmount: subtotal * 0.21,
        total: subtotal * 1.21,
      },
    });

    await prisma.quoteLineItem.deleteMany({ where: { quoteId: id } });
    await prisma.quoteLineItem.create({
      data: {
        quoteId: id,
        description: `Servicio presupuestado ${number}`,
        quantity: 1,
        unitPrice: subtotal,
        vatRate: 21,
      },
    });
  }

  const invoices = [
    ["seed-invoice-atrium-0142", ids.customers.atrium, "F-2026-0142", "SENT", 4200, "2026-06-06T00:00:00.000Z"],
    ["seed-invoice-bruma-0139", ids.customers.bruma, "F-2026-0139", "PAID", 6900, "2026-05-27T00:00:00.000Z"],
    ["seed-invoice-torres-0134", ids.customers.torres, "F-2026-0134", "OVERDUE", 1080, "2026-05-20T00:00:00.000Z"],
    ["seed-invoice-alameda-0129", ids.customers.alameda, "F-2026-0129", "SENT", 1560, "2026-06-08T00:00:00.000Z"],
    ["seed-invoice-logistica-0125", ids.customers.logistica, "F-2026-0125", "DRAFT", 3200, "2026-06-15T00:00:00.000Z"],
  ];

  for (const [id, customerId, number, status, subtotal, dueDate] of invoices) {
    const vatAmount = subtotal * 0.21;
    await prisma.invoice.upsert({
      where: { id },
      update: { status, subtotal, vatAmount, total: subtotal + vatAmount },
      create: {
        id,
        companyId: ids.company,
        customerId,
        number,
        status,
        dueDate: date(dueDate),
        subtotal,
        vatAmount,
        total: subtotal + vatAmount,
      },
    });

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await prisma.invoiceItem.create({
      data: {
        invoiceId: id,
        description: `Servicio facturado ${number}`,
        quantity: 1,
        unitPrice: subtotal,
        vatRate: 21,
      },
    });
  }
}

async function seedPaymentsAndAutomations() {
  await prisma.payment.upsert({
    where: { id: "seed-payment-bruma-0139" },
    update: { status: "SUCCEEDED" },
    create: {
      id: "seed-payment-bruma-0139",
      companyId: ids.company,
      invoiceId: "seed-invoice-bruma-0139",
      provider: "stripe",
      providerRef: "pi_seed_bruma_0139",
      amount: 8349,
      status: "SUCCEEDED",
      paidAt: date("2026-05-25T10:15:00.000Z"),
    },
  });

  const automations = [
    ["seed-automation-reminder", "Recordatorio 24 h antes", "SERVICE_REMINDER", "email+sms", 24],
    ["seed-automation-confirmation", "Confirmación al cliente", "SERVICE_CONFIRMATION", "email", 0],
    ["seed-automation-review", "Solicitud de reseña", "REVIEW_REQUEST", "email", 2],
  ];

  for (const [id, name, trigger, channel, delayHours] of automations) {
    await prisma.automationRule.upsert({
      where: { id },
      update: { isActive: true, delayHours },
      create: {
        id,
        companyId: ids.company,
        name,
        trigger,
        channel,
        delayHours,
        isActive: true,
        template: `${name}: plantilla preparada para preproducción.`,
      },
    });
  }

  await prisma.integration.upsert({
    where: { companyId_provider: { companyId: ids.company, provider: "google_calendar" } },
    update: { status: "ready" },
    create: {
      companyId: ids.company,
      provider: "google_calendar",
      status: "ready",
      config: { mode: "preproduction-ready" },
    },
  });
}

async function main() {
  await seedCompany();
  await seedUsers();
  await seedEmployees();
  await seedCustomers();
  await seedLeads();
  await seedServices();
  await seedQuotesAndInvoices();
  await seedPaymentsAndAutomations();

  console.log("Seed de preproducción completado.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
