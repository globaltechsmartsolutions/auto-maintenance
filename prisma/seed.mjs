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
  worksites: {
    atrium: "seed-worksite-atrium",
    alameda: "seed-worksite-alameda",
    torres: "seed-worksite-torres",
  },
  shifts: {
    atrium: "seed-shift-atrium-morning",
    alameda: "seed-shift-alameda-morning",
    torres: "seed-shift-torres-morning",
  },
};

const date = (value) => new Date(value);

async function seedCompany() {
  return prisma.company.upsert({
    where: { id: ids.company },
    update: {
      plan: "GROWTH",
      subscriptionStatus: "TRIALING",
      billingEmail: "billing@cleaningdemo.com",
      crmEnabled: false,
    },
    create: {
      id: ids.company,
      name: "CleanWorks Demo Ltd",
      fiscalName: "CleanWorks Demo Limited",
      cif: "B10999888",
      email: "hello@cleaningdemo.com",
      phone: "+34 910 220 330",
      website: "https://cleaningdemo.com",
      address: "Calle Serrano 42",
      city: "Madrid",
      province: "Madrid",
      postalCode: "28001",
      billingEmail: "billing@cleaningdemo.com",
      plan: "GROWTH",
      subscriptionStatus: "TRIALING",
      trialEndsAt: date("2026-06-30T23:59:59.000Z"),
      crmEnabled: false,
    },
  });
}

async function seedUsers() {
  const users = [
    {
      id: ids.users.admin,
      supabaseUserId: "seed-supabase-admin",
      email: "admin@cleaningdemo.com",
      firstName: "Alejandro",
      lastName: "Martín",
      role: "ADMIN",
      status: "ACTIVE",
    },
    {
      id: ids.users.manager,
      supabaseUserId: "seed-supabase-manager",
      email: "manager@cleaningdemo.com",
      firstName: "Marta",
      lastName: "Soler",
      role: "MANAGER",
      status: "ACTIVE",
    },
    {
      id: ids.users.employee,
      supabaseUserId: "seed-supabase-employee",
      email: "laura@cleaningdemo.com",
      firstName: "Laura",
      lastName: "Méndez",
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
    {
      id: ids.users.employee2,
      supabaseUserId: "seed-supabase-employee-2",
      email: "miguel@cleaningdemo.com",
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
      position: "Team lead",
      hourlyRate: 18.5,
      performanceScore: 98,
      availability: { days: ["L", "M", "X", "J", "V"], from: "07:00", to: "15:00" },
      internalNotes: "Excellent rating for premium offices.",
      hiredAt: date("2024-02-12T00:00:00.000Z"),
    },
    {
      id: ids.employees.miguel,
      userId: ids.users.employee2,
      position: "Healthcare specialist",
      hourlyRate: 19.25,
      performanceScore: 94,
      availability: { days: ["L", "M", "X", "J", "V", "S"], from: "06:00", to: "14:00" },
      internalNotes: "Advanced disinfection certification.",
      hiredAt: date("2023-11-03T00:00:00.000Z"),
    },
    {
      id: ids.employees.nadia,
      userId: ids.users.manager,
      position: "Coordinadora operativa",
      hourlyRate: 21,
      performanceScore: 91,
      availability: { days: ["L", "M", "X", "J", "V"], from: "08:00", to: "16:00" },
      internalNotes: "Good fit for residential communities and garages.",
      hiredAt: date("2022-06-20T00:00:00.000Z"),
    },
    {
      id: ids.employees.hugo,
      userId: ids.users.admin,
      position: "Account supervisor",
      hourlyRate: 24,
      performanceScore: 88,
      availability: { status: "on leave", returnsAt: "2026-06-05" },
      internalNotes: "Plan a replacement this week.",
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
      email: "marta@atriumlabs.com",
      phone: "+34 611 204 338",
      nif: "B88321190",
      address: "Calle Serrano 42",
      city: "Madrid",
      province: "Madrid",
      postalCode: "28001",
      tags: ["B2B", "Madrid", "Premium"],
      notes: "Recurring service from Monday to Friday. Prefers email communication.",
      lifetimeValue: 48600,
    },
    {
      id: ids.customers.alameda,
      name: "Alameda Clinic",
      type: "BUSINESS",
      status: "AT_RISK",
      email: "administration@alamedaclinic.com",
      phone: "+34 934 778 201",
      nif: "B64112003",
      address: "Avinguda Diagonal 318",
      city: "Barcelona",
      province: "Barcelona",
      postalCode: "08013",
      tags: ["Barcelona", "High priority", "Healthcare"],
      notes: "Requires enhanced protocols and a disinfectant product log.",
      lifetimeValue: 31200,
    },
    {
      id: ids.customers.bruma,
      name: "Hotel Bruma",
      type: "BUSINESS",
      status: "ACTIVE",
      email: "ops@brumahotel.com",
      phone: "+34 965 222 910",
      nif: "B54388112",
      address: "9 Seafront Avenue",
      city: "Alicante",
      province: "Alicante",
      postalCode: "03002",
      tags: ["Alicante", "High season"],
      notes: "Summer support contract. Fortnightly billing with standard VAT.",
      lifetimeValue: 58400,
    },
    {
      id: ids.customers.torres,
      name: "Northern Towers Community",
      type: "COMMUNITY",
      status: "ACTIVE",
      email: "northerntowers@urbalia.com",
      phone: "+34 912 667 810",
      nif: "H87990111",
      address: "14 Station Street",
      city: "Getafe",
      province: "Madrid",
      postalCode: "28901",
      tags: ["Community", "Monthly"],
      notes: "Includes garage, entrances, and windows. Review lift B incidents.",
      lifetimeValue: 22800,
    },
    {
      id: ids.customers.logistica,
      name: "Southern Logistics",
      type: "INDUSTRIAL",
      status: "ACTIVE",
      email: "operations@southernlogistics.com",
      phone: "+34 955 440 802",
      nif: "B91700123",
      address: "Island Industrial Estate, Unit 18",
      city: "Dos Hermanas",
      province: "Sevilla",
      postalCode: "41703",
      tags: ["Industrial", "Sevilla", "Quote"],
      notes: "Requires warehouse and adjoining office cleaning.",
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
    ["seed-lead-clinica-alameda", "Alameda Clinic", "Alameda Clinic", "QUALIFIED", 3800, 75, ["Healthcare"]],
    ["seed-lead-torres-norte", "Urbalia Administrator", "Northern Towers Community", "NEW", 1200, 45, ["Community"]],
    ["seed-lead-boreal", "Ana Ferrer", "Boreal Cowork", "NEW", 2400, 35, ["Coworking"]],
    ["seed-lead-hotel-bruma", "Lucía Ríos", "Hotel Bruma", "QUOTED", 8400, 80, ["Hotel"]],
    ["seed-lead-residential-alba", "Residencial Alba", "Residencial Alba", "QUALIFIED", 2100, 60, ["Community"]],
    ["seed-lead-central-market", "Central Market", "Central Market", "QUALIFIED", 1900, 55, ["Retail"]],
    ["seed-lead-nova-legal", "Nova Legal", "Nova Legal", "WON", 1500, 100, ["Offices"]],
    ["seed-lead-logistica-sur", "Southern Logistics", "Southern Logistics", "QUOTED", 3200, 70, ["Industrial"]],
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
        email: `${companyName.toLowerCase().replaceAll(" ", ".")}@demo.com`,
        phone: "+34 600 000 000",
        source: "Pre-production demo",
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
    ["seed-service-atrium-office", ids.customers.atrium, "Daily office cleaning", "Offices", "WEEKLY", "SCHEDULED", "2026-06-01T08:30:00.000Z", 1260],
    ["seed-service-alameda-clinic", ids.customers.alameda, "Clinic disinfection", "Healthcare", "ONE_TIME", "PENDING", "2026-06-02T07:00:00.000Z", 780],
    ["seed-service-bruma-common", ids.customers.bruma, "Hotel common areas", "Hotel", "DAILY", "IN_PROGRESS", "2026-05-29T10:00:00.000Z", 2150],
    ["seed-service-torres-garage", ids.customers.torres, "Windows and garage", "Community", "MONTHLY", "COMPLETED", "2026-05-28T09:00:00.000Z", 540],
    ["seed-service-atrium-consumables", ids.customers.atrium, "Consumables restocking", "Offices", "MONTHLY", "SCHEDULED", "2026-06-03T11:00:00.000Z", 360],
    ["seed-service-bruma-lobby", ids.customers.bruma, "Lobby upholstery", "Hotel", "ONE_TIME", "PENDING", "2026-06-07T10:00:00.000Z", 980],
    ["seed-service-logistica-warehouse", ids.customers.logistica, "Warehouse cleaning", "Industrial", "ONE_TIME", "SCHEDULED", "2026-06-05T06:30:00.000Z", 3200],
    ["seed-service-torres-portals", ids.customers.torres, "Entrances and lifts", "Community", "WEEKLY", "SCHEDULED", "2026-06-06T08:00:00.000Z", 620],
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
        description: `Service presupuestado ${number}`,
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
        description: `Invoiced service ${number}`,
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
    ["seed-automation-reminder", "24-hour reminder", "SERVICE_REMINDER", "email+sms", 24],
    ["seed-automation-confirmation", "Customer confirmation", "SERVICE_CONFIRMATION", "email", 0],
    ["seed-automation-review", "Review request", "REVIEW_REQUEST", "email", 2],
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
        template: `${name}: template prepared for pre-production.`,
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

async function seedWiaControl() {
  const worksites = [
    {
      id: ids.worksites.atrium,
      customerId: ids.customers.atrium,
      name: "Atrium Labs · Serrano",
      address: "Calle Serrano 42",
      city: "Madrid",
      province: "Madrid",
      postalCode: "28001",
      latitude: 40.4271,
      longitude: -3.6854,
      radiusMeters: 120,
      verificationMode: "QR_LOCATION",
    },
    {
      id: ids.worksites.alameda,
      customerId: ids.customers.alameda,
      name: "Alameda Clinic",
      address: "Avinguda Diagonal 318",
      city: "Barcelona",
      province: "Barcelona",
      postalCode: "08013",
      latitude: 41.4036,
      longitude: 2.1744,
      radiusMeters: 80,
      verificationMode: "PIN",
    },
    {
      id: ids.worksites.torres,
      customerId: ids.customers.torres,
      name: "Northern Towers · Entrances",
      address: "14 Station Street",
      city: "Getafe",
      province: "Madrid",
      postalCode: "28901",
      latitude: 40.3083,
      longitude: -3.7327,
      radiusMeters: 90,
      verificationMode: "QR_LOCATION",
    },
  ];

  for (const worksite of worksites) {
    await prisma.worksite.upsert({
      where: { id: worksite.id },
      update: worksite,
      create: { ...worksite, companyId: ids.company },
    });
  }

  const shifts = [
    {
      id: ids.shifts.atrium,
      worksiteId: ids.worksites.atrium,
      employeeId: ids.employees.laura,
      serviceId: "seed-service-atrium-office",
      title: "Opening clean",
      scheduledStart: date("2026-08-08T04:00:00.000Z"),
      scheduledEnd: date("2026-08-08T07:00:00.000Z"),
      status: "ACTIVE",
      requiredSkills: ["offices", "premium"],
      gracePeriodMinutes: 5,
    },
    {
      id: ids.shifts.alameda,
      worksiteId: ids.worksites.alameda,
      employeeId: ids.employees.miguel,
      serviceId: "seed-service-alameda-clinic",
      title: "Clinic disinfection",
      scheduledStart: date("2026-08-08T05:00:00.000Z"),
      scheduledEnd: date("2026-08-08T07:30:00.000Z"),
      status: "ACTIVE",
      requiredSkills: ["healthcare", "disinfection"],
      gracePeriodMinutes: 5,
    },
    {
      id: ids.shifts.torres,
      worksiteId: ids.worksites.torres,
      employeeId: null,
      serviceId: "seed-service-torres-garage",
      title: "Entrances and windows",
      scheduledStart: date("2026-08-08T05:00:00.000Z"),
      scheduledEnd: date("2026-08-08T08:00:00.000Z"),
      status: "UNCOVERED",
      requiredSkills: ["communities", "windows"],
      gracePeriodMinutes: 5,
    },
  ];

  for (const shift of shifts) {
    await prisma.plannedShift.upsert({
      where: { id: shift.id },
      update: shift,
      create: { ...shift, companyId: ids.company },
    });
  }

  const clockEvents = [
    {
      id: "seed-clock-laura-in",
      shiftId: ids.shifts.atrium,
      employeeId: ids.employees.laura,
      worksiteId: ids.worksites.atrium,
      type: "CLOCK_IN",
      method: "QR",
      occurredAt: date("2026-08-08T04:02:00.000Z"),
      recordedAt: date("2026-08-08T04:02:04.000Z"),
      locationVerified: true,
      idempotencyKey: "seed-laura-in-2026-08-08",
      integrityHash: "seed-integrity-laura-in-2026-08-08",
    },
    {
      id: "seed-clock-miguel-in",
      shiftId: ids.shifts.alameda,
      employeeId: ids.employees.miguel,
      worksiteId: ids.worksites.alameda,
      type: "CLOCK_IN",
      method: "PIN",
      occurredAt: date("2026-08-08T05:11:00.000Z"),
      recordedAt: date("2026-08-08T05:11:03.000Z"),
      locationVerified: true,
      idempotencyKey: "seed-miguel-in-2026-08-08",
      integrityHash: "seed-integrity-miguel-in-2026-08-08",
    },
  ];

  for (const event of clockEvents) {
    const existing = await prisma.clockEvent.findUnique({ where: { id: event.id } });
    if (!existing) {
      await prisma.clockEvent.create({
        data: { ...event, companyId: ids.company },
      });
    }
  }

  await prisma.attendanceIncident.upsert({
    where: { id: "seed-incident-torres-uncovered" },
    update: {
      status: "OPEN",
      recommendedEmployeeId: ids.employees.nadia,
    },
    create: {
      id: "seed-incident-torres-uncovered",
      companyId: ids.company,
      shiftId: ids.shifts.torres,
      worksiteId: ids.worksites.torres,
      recommendedEmployeeId: ids.employees.nadia,
      type: "MISSING_CLOCK_IN",
      status: "OPEN",
      title: "Uncovered service",
      detail: "The 07:00 shift needs a replacement.",
      detectedAt: date("2026-08-08T05:05:00.000Z"),
    },
  });

  await prisma.attendanceIncident.upsert({
    where: { id: "seed-incident-alameda-late" },
    update: { status: "ACKNOWLEDGED" },
    create: {
      id: "seed-incident-alameda-late",
      companyId: ids.company,
      shiftId: ids.shifts.alameda,
      employeeId: ids.employees.miguel,
      worksiteId: ids.worksites.alameda,
      type: "LATE",
      status: "ACKNOWLEDGED",
      title: "Clock-in 6 minutes late",
      detail: "The clock event is valid and awaiting an explanation.",
      detectedAt: date("2026-08-08T05:11:03.000Z"),
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
  await seedWiaControl();

  console.log("Pre-production seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
